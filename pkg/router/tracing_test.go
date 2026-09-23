package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func setupRouterTracing(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	previousProvider, previousPropagator := otel.GetTracerProvider(), otel.GetTextMapPropagator()
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() {
		otel.SetTracerProvider(previousProvider)
		otel.SetTextMapPropagator(previousPropagator)
		require.NoError(t, provider.Shutdown(context.Background()))
	})
	return recorder
}

func TestBackendTracing(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusBadRequest, http.StatusServiceUnavailable} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			recorder := setupRouterTracing(t)
			parentCtx, parent := otel.Tracer("test").Start(t.Context(), "parent")
			defer parent.End()
			req := httptest.NewRequest(http.MethodPost, "/apis/test.grafana.app/v1/resources", nil)
			otel.GetTextMapPropagator().Inject(parentCtx, propagation.HeaderCarrier(req.Header))
			var backendContext trace.SpanContext
			serveThroughBreaker(newGroupBreaker("test.grafana.app"), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				backendContext = trace.SpanContextFromContext(r.Context())
				w.WriteHeader(status)
			}), httptest.NewRecorder(), req)
			spans := recorder.Ended()
			require.Len(t, spans, 1)
			require.Equal(t, "router.backend", spans[0].Name())
			require.Equal(t, parent.SpanContext().SpanID(), spans[0].Parent().SpanID())
			require.Equal(t, backendContext, spans[0].SpanContext())
			require.Contains(t, spans[0].Attributes(), attribute.String("grafana.router.group", "test.grafana.app"))
			require.Contains(t, spans[0].Attributes(), attribute.String("http.request.method", http.MethodPost))
			require.Contains(t, spans[0].Attributes(), attribute.Int("http.response.status_code", status))
			if status >= 500 {
				require.Equal(t, codes.Error, spans[0].Status().Code)
			} else {
				require.Equal(t, codes.Unset, spans[0].Status().Code)
			}
		})
	}
}

func TestProxyTracing(t *testing.T) {
	for _, mode := range []string{"forward", "aggregate", "single-tenant"} {
		t.Run(mode, func(t *testing.T) {
			recorder := setupRouterTracing(t)
			upstreamContext := make(chan trace.SpanContext, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))
				upstreamContext <- trace.SpanContextFromContext(ctx)
				w.WriteHeader(http.StatusNoContent)
			}))
			defer upstream.Close()
			group := metav1.APIGroup{Name: "test.grafana.app"}
			transport := upstream.Client().Transport.(*http.Transport)
			var backend Backend
			var handler http.Handler
			var err error
			if mode == "forward" {
				backend, err = NewForwardBackend(group, forwardSpec(upstream.URL), "1", transport)
			} else if mode == "aggregate" {
				base, parseErr := url.Parse(upstream.URL)
				require.NoError(t, parseErr)
				backend, err = newAggregateBackend("test", group, base, transport)
			} else {
				handler, err = newSingleTenantFallback(singleTenantFallbackOptions{
					cacheSize: 10, transport: transport,
					resolveHost: func(context.Context, int64) (string, error) { return upstream.URL, nil },
				})
			}
			require.NoError(t, err)
			if backend != nil {
				handler, err = backend.Load(t.Context())
				require.NoError(t, err)
			}
			ctx, parent := otel.Tracer("test").Start(t.Context(), "parent")
			defer parent.End()
			req := httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1/namespaces/stacks-1234/resources", nil).WithContext(ctx)
			// A context parent must take precedence over an older forwarded header.
			req.Header.Set("traceparent", "00-11111111111111111111111111111111-1111111111111111-01")
			response := httptest.NewRecorder()
			serveThroughBreaker(newGroupBreaker(group.Name), handler, response, req)
			require.Equal(t, http.StatusNoContent, response.Code)
			propagated := <-upstreamContext
			require.Equal(t, parent.SpanContext().TraceID(), propagated.TraceID())
			spans := recorder.Ended()
			require.Len(t, spans, 2)
			require.Equal(t, trace.SpanKindClient, spans[0].SpanKind())
			require.Equal(t, propagated.SpanID(), spans[0].SpanContext().SpanID())
			require.Equal(t, spans[1].SpanContext().SpanID(), spans[0].Parent().SpanID())
			require.Equal(t, parent.SpanContext().SpanID(), spans[1].Parent().SpanID())
		})
	}
}

func TestBackendTracingOpenCircuit(t *testing.T) {
	recorder := setupRouterTracing(t)
	breaker := newGroupBreaker("test.grafana.app")
	calls := 0
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusServiceUnavailable)
	})
	for range 7 {
		serveThroughBreaker(breaker, handler, httptest.NewRecorder(),
			httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1", nil))
	}
	require.Equal(t, 6, calls)
	spans := recorder.Ended()
	require.Len(t, spans, 7)
	require.Equal(t, codes.Error, spans[6].Status().Code)
	require.Contains(t, spans[6].Attributes(), attribute.Int("http.response.status_code", http.StatusServiceUnavailable))
}

func TestBackendTracingCancellation(t *testing.T) {
	recorder := setupRouterTracing(t)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	serveThroughBreaker(newGroupBreaker("test.grafana.app"), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cancel()
	}), httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1", nil).WithContext(ctx))
	spans := recorder.Ended()
	require.Len(t, spans, 1)
	require.Equal(t, codes.Error, spans[0].Status().Code)
	require.Equal(t, context.Canceled.Error(), spans[0].Status().Description)
	require.Len(t, spans[0].Events(), 1)
}

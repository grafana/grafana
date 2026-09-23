package router

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
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
			serveThroughBreaker(newGroupBreaker("test.grafana.app"), "test.grafana.app", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
			switch mode {
			case "forward":
				backend, err = NewForwardBackend(group, forwardSpec(upstream.URL), "1", transport)
			case "aggregate":
				base, parseErr := url.Parse(upstream.URL)
				require.NoError(t, parseErr)
				backend, err = newAggregateBackend("test", group, base, transport)
			default:
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
			serveThroughBreaker(newGroupBreaker(group.Name), group.Name, handler, response, req)
			require.Equal(t, http.StatusNoContent, response.Code)
			propagated := <-upstreamContext
			require.Equal(t, parent.SpanContext().TraceID(), propagated.TraceID())
			spans := recorder.Ended()
			require.Len(t, spans, 2)
			require.Equal(t, trace.SpanKindClient, spans[0].SpanKind())
			require.Equal(t, "GET", spans[0].Name())
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
		serveThroughBreaker(breaker, "test.grafana.app", handler, httptest.NewRecorder(),
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
	serveThroughBreaker(newGroupBreaker("test.grafana.app"), "test.grafana.app", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cancel()
	}), httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1", nil).WithContext(ctx))
	spans := recorder.Ended()
	require.Len(t, spans, 1)
	require.Equal(t, codes.Unset, spans[0].Status().Code)
	require.Contains(t, spans[0].Attributes(), attribute.Bool("grafana.router.canceled", true))
	require.Empty(t, spans[0].Events())
	for _, attr := range spans[0].Attributes() {
		require.NotEqual(t, attribute.Key("http.response.status_code"), attr.Key)
	}
}

func TestBackendTracingDeadline(t *testing.T) {
	recorder := setupRouterTracing(t)
	ctx, cancel := context.WithDeadline(t.Context(), time.Now().Add(-time.Second))
	defer cancel()
	serveThroughBreaker(newGroupBreaker("test.grafana.app"), "test.grafana.app", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusGatewayTimeout)
	}), httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1", nil).WithContext(ctx))
	spans := recorder.Ended()
	require.Len(t, spans, 1)
	require.Equal(t, codes.Error, spans[0].Status().Code)
	require.Contains(t, spans[0].Attributes(), attribute.String("error.type", "timeout"))
	require.Empty(t, spans[0].Events(), "the timeout attribute is sufficient without a duplicate exception event")
}

func TestBackendTracingUnknownMethod(t *testing.T) {
	recorder := setupRouterTracing(t)
	serveThroughBreaker(newGroupBreaker("test.grafana.app"), "test.grafana.app", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "CUSTOM", r.Method, "normalization must only affect telemetry")
		w.WriteHeader(http.StatusMethodNotAllowed)
	}), httptest.NewRecorder(), httptest.NewRequest("CUSTOM", "/apis/test.grafana.app/v1", nil))
	spans := recorder.Ended()
	require.Len(t, spans, 1)
	require.Equal(t, "router.backend", spans[0].Name())
	require.Contains(t, spans[0].Attributes(), attribute.String("http.request.method", "_OTHER"))
	require.Equal(t, codes.Unset, spans[0].Status().Code)
}

func TestOpenAPIBackendTracing(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusServiceUnavailable} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			spans := setupRouterTracing(t)
			hits := 0
			router := buildRouterWithBackend("test.grafana.app", "1", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				hits++
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				_, _ = w.Write([]byte(`{"openapi":"3.0.0"}`))
			}))
			for range 2 {
				response := httptest.NewRecorder()
				req := httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/test.grafana.app/v1?hash=revision", nil)
				router.HandleFunc(response, req, http.NotFoundHandler())
				require.Equal(t, status, response.Code)
			}
			if status == http.StatusOK {
				require.Equal(t, 1, hits, "cache hits must not call or trace the backend")
			} else {
				require.Equal(t, 2, hits, "failed responses must not be cached")
			}
			ended := spans.Ended()
			require.Len(t, ended, hits)
			for _, span := range ended {
				require.Equal(t, "router.backend", span.Name())
				require.Contains(t, span.Attributes(), attribute.String("grafana.router.group", "test.grafana.app"))
				require.Contains(t, span.Attributes(), attribute.Int("http.response.status_code", status))
				if status >= 500 {
					require.Equal(t, codes.Error, span.Status().Code)
				}
			}
		})
	}
}

func TestDiscoveryBackendTracing(t *testing.T) {
	for _, mode := range []string{"aggregate", "legacy", "unavailable"} {
		t.Run(mode, func(t *testing.T) {
			recorder := setupRouterTracing(t)
			ctx, parent := otel.Tracer("test").Start(t.Context(), "parent")
			defer parent.End()
			const group = "test.grafana.app"
			router := discoveryRouter(t, group, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				switch mode {
				case "unavailable":
					w.WriteHeader(http.StatusServiceUnavailable)
				case "legacy":
					if req.URL.Path == "/apis" {
						http.NotFound(w, req)
						return
					}
					require.Equal(t, "/apis/"+group+"/v1", req.URL.Path)
					require.NoError(t, json.NewEncoder(w).Encode(metav1.APIResourceList{TypeMeta: metav1.TypeMeta{Kind: "APIResourceList"}}))
				default:
					require.Equal(t, "/apis", req.URL.Path)
					require.NoError(t, json.NewEncoder(w).Encode(apidiscoveryv2.APIGroupDiscoveryList{
						TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
						Items:    []apidiscoveryv2.APIGroupDiscovery{{ObjectMeta: metav1.ObjectMeta{Name: group}}},
					}))
				}
			}))
			req := httptest.NewRequest(http.MethodGet, "/apis", nil).WithContext(ctx)
			req.Header.Set("Accept", aggregatedDiscoveryJSON)
			response := httptest.NewRecorder()
			router.HandleFunc(response, req, http.NotFoundHandler())
			require.Equal(t, http.StatusOK, response.Code)
			expected := 1
			if mode == "legacy" {
				expected = 2
			}
			var spans []sdktrace.ReadOnlySpan
			for _, span := range recorder.Ended() {
				if span.Name() == "router.backend" {
					spans = append(spans, span)
				}
			}
			require.Len(t, spans, expected)
			for _, span := range spans {
				require.Equal(t, "router.backend", span.Name())
				require.Equal(t, parent.SpanContext().SpanID(), span.Parent().SpanID())
				require.Contains(t, span.Attributes(), attribute.String("grafana.router.group", group))
				if mode == "unavailable" {
					require.Equal(t, codes.Error, span.Status().Code)
				}
			}
		})
	}
}

func TestBackendTracingResponseStatus(t *testing.T) {
	for _, tc := range []struct {
		name   string
		handle func(http.ResponseWriter)
		status int
	}{
		{"empty", func(http.ResponseWriter) {}, http.StatusOK},
		{"implicit", func(w http.ResponseWriter) {
			_, _ = w.Write([]byte("body"))
			w.WriteHeader(http.StatusServiceUnavailable)
		}, http.StatusOK},
		{"explicit", func(w http.ResponseWriter) {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.WriteHeader(http.StatusOK)
		}, http.StatusServiceUnavailable},
		{"informational", func(w http.ResponseWriter) { w.WriteHeader(http.StatusEarlyHints); w.WriteHeader(http.StatusCreated) }, http.StatusCreated},
		{"informational only", func(w http.ResponseWriter) { w.WriteHeader(http.StatusEarlyHints) }, http.StatusOK},
		{"flush", func(w http.ResponseWriter) {
			_ = http.NewResponseController(w).Flush()
			w.WriteHeader(http.StatusServiceUnavailable)
		}, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := setupRouterTracing(t)
			done := make(chan struct{})
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				defer close(done)
				serveThroughBreaker(newGroupBreaker("test.grafana.app"), "test.grafana.app", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) { tc.handle(w) }), w, req)
			}))
			defer server.Close()
			res, err := server.Client().Get(server.URL)
			require.NoError(t, err)
			_, err = io.Copy(io.Discard, res.Body)
			require.NoError(t, err)
			require.NoError(t, res.Body.Close())
			<-done
			require.Equal(t, tc.status, res.StatusCode)
			spans := recorder.Ended()
			require.Len(t, spans, 1)
			require.Contains(t, spans[0].Attributes(), attribute.Int("http.response.status_code", tc.status))
			expected := codes.Unset
			if tc.status >= 500 {
				expected = codes.Error
			}
			require.Equal(t, expected, spans[0].Status().Code)
		})
	}
}

func TestBackendTracingPanic(t *testing.T) {
	for _, status := range []int{0, http.StatusOK} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			recorder := setupRouterTracing(t)
			sentinel := "private panic detail"
			require.PanicsWithValue(t, sentinel, func() {
				serveThroughBreaker(newGroupBreaker("test.grafana.app"), "test.grafana.app", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					if status != 0 {
						w.WriteHeader(status)
					}
					panic(sentinel)
				}), httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1", nil))
			})
			spans := recorder.Ended()
			require.Len(t, spans, 1)
			require.Equal(t, codes.Error, spans[0].Status().Code)
			require.Contains(t, spans[0].Attributes(), attribute.String("error.type", "panic"))
			require.Empty(t, spans[0].Status().Description)
			require.Empty(t, spans[0].Events())
			if status != 0 {
				require.Contains(t, spans[0].Attributes(), attribute.Int("http.response.status_code", status))
			} else {
				for _, attr := range spans[0].Attributes() {
					require.NotEqual(t, attribute.Key("http.response.status_code"), attr.Key)
				}
			}
		})
	}
}

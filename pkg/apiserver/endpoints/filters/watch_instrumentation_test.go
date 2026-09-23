package filters

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestWithWatchInstrumentation(t *testing.T) {
	t.Parallel()

	newRequest := func(info *request.RequestInfo) (*http.Request, *tracetest.SpanRecorder, func()) {
		recorder := tracetest.NewSpanRecorder()
		tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))

		req := httptest.NewRequest(http.MethodGet, "/apis/foo.grafana.app/v1/namespaces/default/bars", nil)
		ctx, span := tp.Tracer("test").Start(req.Context(), "GET /apis/foo.grafana.app/v1/namespaces/{:namespace}/bars")
		if info != nil {
			ctx = request.WithRequestInfo(ctx, info)
		}
		return req.WithContext(ctx), recorder, func() { span.End() }
	}

	watchInfo := &request.RequestInfo{
		IsResourceRequest: true,
		Verb:              "watch",
		APIGroup:          "foo.grafana.app",
		Resource:          "bars",
	}

	t.Run("tags/renames the span and records establishment on first write", func(t *testing.T) {
		t.Parallel()

		req, recorder, endSpan := newRequest(watchInfo)

		var gotGroup, gotResource string
		var gotDuration time.Duration
		var recorded int
		record := func(group, resource string, d time.Duration) {
			recorded++
			gotGroup, gotResource, gotDuration = group, resource, d
		}

		handler := WithWatchInstrumentation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate the watch handler flushing the stream twice; only the first
			// write should record establishment.
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("event-1"))
		}), record)

		handler.ServeHTTP(httptest.NewRecorder(), req)
		endSpan()

		require.Equal(t, 1, recorded, "establishment should be recorded exactly once")
		assert.Equal(t, "foo.grafana.app", gotGroup)
		assert.Equal(t, "bars", gotResource)
		assert.GreaterOrEqual(t, gotDuration, time.Duration(0))

		spans := recorder.Ended()
		require.Len(t, spans, 1)
		assert.Equal(t, "WATCH foo.grafana.app/bars", spans[0].Name())
		assert.Contains(t, spans[0].Attributes(), attribute.Bool("grafana.watch", true))
	})

	t.Run("records establishment when the handler writes without WriteHeader", func(t *testing.T) {
		t.Parallel()

		req, _, endSpan := newRequest(watchInfo)

		var recorded int
		record := func(group, resource string, d time.Duration) { recorded++ }

		handler := WithWatchInstrumentation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte("event-1"))
		}), record)

		handler.ServeHTTP(httptest.NewRecorder(), req)
		endSpan()

		assert.Equal(t, 1, recorded)
	})

	t.Run("leaves non-watch requests untouched", func(t *testing.T) {
		t.Parallel()

		req, recorder, endSpan := newRequest(&request.RequestInfo{
			IsResourceRequest: true,
			Verb:              "list",
			APIGroup:          "foo.grafana.app",
			Resource:          "bars",
		})

		var recorded int
		handler := WithWatchInstrumentation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}), func(string, string, time.Duration) { recorded++ })

		handler.ServeHTTP(httptest.NewRecorder(), req)
		endSpan()

		assert.Equal(t, 0, recorded, "non-watch requests should not record establishment")
		spans := recorder.Ended()
		require.Len(t, spans, 1)
		assert.Equal(t, "GET /apis/foo.grafana.app/v1/namespaces/{:namespace}/bars", spans[0].Name())
		assert.NotContains(t, spans[0].Attributes(), attribute.Bool("grafana.watch", true))
	})

	t.Run("does not record and does not panic with a nil recorder", func(t *testing.T) {
		t.Parallel()

		req, recorder, endSpan := newRequest(watchInfo)

		var served bool
		handler := WithWatchInstrumentation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			served = true
			w.WriteHeader(http.StatusOK)
		}), nil)

		handler.ServeHTTP(httptest.NewRecorder(), req)
		endSpan()

		assert.True(t, served)
		spans := recorder.Ended()
		require.Len(t, spans, 1)
		assert.Equal(t, "WATCH foo.grafana.app/bars", spans[0].Name(), "span is still tagged/renamed without a recorder")
	})

	t.Run("does not panic when RequestInfo is absent", func(t *testing.T) {
		t.Parallel()

		req, _, endSpan := newRequest(nil)

		var served bool
		handler := WithWatchInstrumentation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			served = true
			w.WriteHeader(http.StatusOK)
		}), func(string, string, time.Duration) {})

		handler.ServeHTTP(httptest.NewRecorder(), req)
		endSpan()

		assert.True(t, served)
	})
}

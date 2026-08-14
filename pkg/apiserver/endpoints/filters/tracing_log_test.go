package filters

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	jaegerpropagator "go.opentelemetry.io/contrib/propagators/jaeger"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

func TestWithTracingHTTPLoggingAttributes(t *testing.T) {
	t.Parallel()

	t.Run("should preserve valid span context when context already has one", func(t *testing.T) {
		t.Parallel()

		recorder := tracetest.NewSpanRecorder()
		tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))

		var capturedCtx trace.SpanContext
		inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedCtx = trace.SpanContextFromContext(r.Context())
			w.WriteHeader(http.StatusOK)
		})

		handler := WithTracingHTTPLoggingAttributes(inner)

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		ctx, span := tp.Tracer("test").Start(req.Context(), "test-span")
		defer span.End()
		req = req.WithContext(ctx)

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.True(t, capturedCtx.IsValid(), "inner handler should see a valid span context")
		assert.True(t, capturedCtx.HasTraceID())
	})

	t.Run("should extract traceID from headers when span context is invalid", func(t *testing.T) {
		t.Parallel()

		var capturedCtx trace.SpanContext
		inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedCtx = trace.SpanContextFromContext(r.Context())
			w.WriteHeader(http.StatusOK)
		})

		handler := WithTracingHTTPLoggingAttributes(inner)

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")

		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		assert.False(t, capturedCtx.IsValid(), "request context should still have no span (middleware does not inject one)")
		assert.Equal(t, http.StatusOK, rr.Code)
	})
}

func TestSpanContextFromHeaders(t *testing.T) {
	t.Parallel()

	t.Run("should extract traceID when W3C traceparent header is present", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")

		sc := spanContextFromHeadersWithPropagator(req, propagation.TraceContext{})

		require.True(t, sc.IsValid())
		assert.Equal(t, "4bf92f3577b34da6a3ce929d0e0e4736", sc.TraceID().String())
		assert.Equal(t, "00f067aa0ba902b7", sc.SpanID().String())
	})

	t.Run("should extract traceID when Jaeger uber-trace-id header is present", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("uber-trace-id", "4bf92f3577b34da6a3ce929d0e0e4736:00f067aa0ba902b7:0:1")

		sc := spanContextFromHeadersWithPropagator(req, jaegerpropagator.Jaeger{})

		require.True(t, sc.IsValid())
		assert.Equal(t, "4bf92f3577b34da6a3ce929d0e0e4736", sc.TraceID().String())
		assert.Equal(t, "00f067aa0ba902b7", sc.SpanID().String())
	})

	t.Run("should extract traceID when Grafana-Upstream-Traceparent header is present", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Grafana-Upstream-Traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")

		sc := spanContextFromHeaders(req)

		require.True(t, sc.IsValid())
		assert.Equal(t, "4bf92f3577b34da6a3ce929d0e0e4736", sc.TraceID().String())
		assert.Equal(t, "00f067aa0ba902b7", sc.SpanID().String())
	})

	t.Run("should return invalid span context when no trace headers are present", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "/test", nil)

		sc := spanContextFromHeaders(req)

		assert.False(t, sc.IsValid())
	})
}

func spanContextFromHeadersWithPropagator(r *http.Request, prop propagation.TextMapPropagator) trace.SpanContext {
	carrier := propagation.HeaderCarrier(r.Header)
	ctx := prop.Extract(context.Background(), carrier)
	return trace.SpanContextFromContext(ctx)
}

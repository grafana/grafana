package filters

import (
	"context"
	"net/http"

	jaegerpropagator "go.opentelemetry.io/contrib/propagators/jaeger"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apiserver/pkg/server/httplog"
)

// WithTracingHTTPLoggingAttributes adds tracing attributes to HTTP request logs.
func WithTracingHTTPLoggingAttributes(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		spanCtx := trace.SpanContextFromContext(r.Context())
		if !spanCtx.IsValid() {
			spanCtx = spanContextFromHeaders(r)
		}

		if spanCtx.HasTraceID() {
			httplog.AddKeyValue(r.Context(), "traceID", spanCtx.TraceID().String())
		}

		if spanCtx.HasSpanID() {
			httplog.AddKeyValue(r.Context(), "spanID", spanCtx.SpanID().String())
		}

		handler.ServeHTTP(w, r)
	})
}

func spanContextFromHeaders(r *http.Request) trace.SpanContext {
	// This is a fallback for when the current span in the request context has no valid trace context.
	carrier := propagation.HeaderCarrier(r.Header)
	ctx := otel.GetTextMapPropagator().Extract(context.Background(), carrier)
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
		return sc
	}
	ctx = jaegerpropagator.Jaeger{}.Extract(context.Background(), carrier)
	return trace.SpanContextFromContext(ctx)
}

package filters

import (
	"context"
	"net/http"

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

// spanContextFromHeaders extracts a span context directly from request headers
// using OTel propagators. This is a fallback for when the current span in the
// request context has no valid trace context (e.g. noop TracerProvider overwrote
// a previously-extracted remote span context).
func spanContextFromHeaders(r *http.Request) trace.SpanContext {
	carrier := propagation.HeaderCarrier(r.Header)

	ctx := otel.GetTextMapPropagator().Extract(context.Background(), carrier)
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
		return sc
	}

	// The kube-aggregator drops standard traceparent but preserves a custom
	// header injected by the ST proxy. Try that as a last resort.
	if tp := r.Header.Get("Grafana-Upstream-Traceparent"); tp != "" {
		prop := propagation.TraceContext{}
		upstreamCarrier := propagation.MapCarrier{"traceparent": tp}
		ctx = prop.Extract(context.Background(), upstreamCarrier)
		return trace.SpanContextFromContext(ctx)
	}

	return trace.SpanContext{}
}

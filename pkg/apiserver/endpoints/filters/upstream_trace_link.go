package filters

import (
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

// WithExtractUpstreamTraceLink extracts the Grafana-Upstream-Traceparent
// custom header (injected by the ST proxy) and adds a span link to the
// current span. This preserves trace relationships across the vanilla K8s
// API server, which drops incoming W3C trace context.
func WithExtractUpstreamTraceLink(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		upstreamTP := req.Header.Get("Grafana-Upstream-Traceparent")
		if upstreamTP != "" {
			prop := propagation.TraceContext{}
			carrier := propagation.MapCarrier{"traceparent": upstreamTP}
			extractedCtx := prop.Extract(req.Context(), carrier)
			if sc := trace.SpanContextFromContext(extractedCtx); sc.IsValid() && sc.IsRemote() {
				currentSpan := trace.SpanFromContext(req.Context())
				currentSpan.AddLink(trace.Link{SpanContext: sc})
			}
		}
		handler.ServeHTTP(w, req)
	})
}

// ExtractUpstreamSpanContext recovers the upstream trace context from a request's
// headers. The k8s apiserver framework severs req.Context()'s trace context
// during routing, so REST handlers can use this helper to re-parent inner spans
// onto the upstream caller's trace.
//
// It tries the standard `traceparent` header first via the globally configured
// propagator, then falls back to the custom Grafana-Upstream-Traceparent header
// (injected by the kube-aggregator proxy for hops that lose the standard header).
func ExtractUpstreamSpanContext(r *http.Request) trace.SpanContext {
	carrier := propagation.HeaderCarrier(r.Header)
	if sc := trace.SpanContextFromContext(otel.GetTextMapPropagator().Extract(r.Context(), carrier)); sc.IsValid() {
		return sc
	}
	if tp := r.Header.Get("Grafana-Upstream-Traceparent"); tp != "" {
		return trace.SpanContextFromContext(
			propagation.TraceContext{}.Extract(r.Context(), propagation.MapCarrier{"traceparent": tp}),
		)
	}
	return trace.SpanContext{}
}

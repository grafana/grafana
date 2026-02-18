package filters

import (
	"net/http"

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

package filters

import (
	"net/http"

	"go.opentelemetry.io/otel/propagation"
)

// WithExtractTraceContext tries to extract remote trace/span from incoming request using W3C TraceContext.
func WithExtractTraceContext(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		propagator := propagation.TraceContext{}
		ctx := propagator.Extract(req.Context(), propagation.HeaderCarrier(req.Header))
		handler.ServeHTTP(w, req.WithContext(ctx))
	})
}

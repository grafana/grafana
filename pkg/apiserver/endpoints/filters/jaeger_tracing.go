package filters

import (
	"net/http"

	jaegerpropagator "go.opentelemetry.io/contrib/propagators/jaeger"
	"go.opentelemetry.io/otel/propagation"
)

// WithExtractJaegerTrace tries to extract remote trace/span from incoming request.
func WithExtractJaegerTrace(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		propagator := jaegerpropagator.Jaeger{}
		ctx := propagator.Extract(req.Context(), propagation.HeaderCarrier(req.Header))
		handler.ServeHTTP(w, req.WithContext(ctx))
	})
}

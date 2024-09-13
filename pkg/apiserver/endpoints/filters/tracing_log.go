package filters

import (
	"net/http"

	"go.opentelemetry.io/otel/trace"
	"k8s.io/apiserver/pkg/server/httplog"
)

// WithTracingHTTPLoggingAttributes adds tracing attributes to HTTP request logs.
func WithTracingHTTPLoggingAttributes(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		spanCtx := trace.SpanContextFromContext(r.Context())
		if spanCtx.IsValid() {
			if spanCtx.HasTraceID() {
				httplog.AddKeyValue(r.Context(), "traceID", spanCtx.TraceID().String())
			}

			if spanCtx.HasSpanID() {
				httplog.AddKeyValue(r.Context(), "spanID", spanCtx.SpanID().String())
			}
		}

		handler.ServeHTTP(w, r)
	})
}

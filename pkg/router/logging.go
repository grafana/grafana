package router

import (
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// logRequest writes one access-log line per request: successes at Debug, 4xx
// at Warn and 5xx at Error. Unlike the metrics, it logs the raw group, since
// log lines carry no cardinality cost. The trace context is resolved the same
// way as for the router's spans, so the logger's traceID matches the trace.
func logRequest(r *http.Request, group string, status int, duration time.Duration) {
	logger := logging.FromContext(routerTraceContext(r))
	attrs := []any{"method", r.Method, "path", r.URL.Path, "group", group, "status", status, "duration", duration}
	switch {
	case status >= http.StatusInternalServerError:
		logger.Error("router: request failed", attrs...)
	case status >= http.StatusBadRequest:
		logger.Warn("router: request error", attrs...)
	default:
		logger.Debug("router: request", attrs...)
	}
}

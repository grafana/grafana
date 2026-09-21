package router

import (
	"log/slog"
	"net/http"
	"time"
)

// logRequest emits one access-log-style line per request. Level carries the
// only signal worth reacting to without full request tracing: successes stay
// at Debug (off by default), while 4xx/5xx surface at Warn/Error so failures
// are visible at the default level. Unlike the duration histogram's group
// label, the log line carries the raw path/group verbatim -- log lines
// aren't aggregated into a persistent per-value series, so client-controlled
// values here don't carry the same cardinality cost.
func logRequest(r *http.Request, group string, status int, duration time.Duration) {
	attrs := []any{"method", r.Method, "path", r.URL.Path, "group", group, "status", status, "duration", duration}
	switch {
	case status >= http.StatusInternalServerError:
		slog.Error("router: request failed", attrs...)
	case status >= http.StatusBadRequest:
		slog.Warn("router: request error", attrs...)
	default:
		slog.Debug("router: request", attrs...)
	}
}

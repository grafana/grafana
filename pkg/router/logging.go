package router

import (
	"log/slog"
	"net/http"
	"time"
)

// logRequest writes one access-log line per request: successes at Debug, 4xx
// at Warn and 5xx at Error. Unlike the metrics, it logs the raw group, since
// log lines carry no cardinality cost.
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

package router

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// logRequest writes one access-log line per request: successes, and the 401,
// 403 and 404 any caller can trigger, at Debug; other 4xx at Warn; and 5xx at
// Error. Unlike the metrics, it logs the raw group, since log lines carry no
// cardinality cost. The trace context is resolved the same way as for the
// router's spans, so the logger's traceID matches the trace.
func logRequest(r *http.Request, group string, status int, duration time.Duration) {
	ctx := routerTraceContext(r)
	logger := logging.FromContext(ctx)
	routine := status < http.StatusBadRequest || status == http.StatusUnauthorized ||
		status == http.StatusForbidden || status == http.StatusNotFound
	// Routine requests log at Debug, which is usually off: skip building their
	// arguments, which would cost every request.
	if leveled, ok := logger.(interface {
		Enabled(context.Context, slog.Level) bool
	}); ok && routine && !leveled.Enabled(ctx, slog.LevelDebug) {
		return
	}
	attrs := []any{"method", r.Method, "path", r.URL.Path, "group", group, "status", status, "duration", duration}
	switch {
	case status >= http.StatusInternalServerError:
		logger.Error("router: request failed", attrs...)
	case routine:
		logger.Debug("router: request", attrs...)
	default:
		logger.Warn("router: request error", attrs...)
	}
}

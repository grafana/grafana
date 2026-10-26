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
	logger := logging.FromContext(r.Context())
	routine := status < http.StatusBadRequest || status == http.StatusUnauthorized ||
		status == http.StatusForbidden || status == http.StatusNotFound
	// Routine requests log at Debug, which is usually off: skip building their
	// arguments and resolving the trace, which would cost every request.
	if routine && !debugEnabled(r.Context(), logger) {
		return
	}
	if ctx := routerTraceContext(r); ctx != r.Context() {
		logger = logger.WithContext(ctx)
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

// debugEnabled reports whether logger writes Debug lines. The SDK's
// SLogLogger, which Grafana installs, has no Enabled method of its own, so its
// slog.Logger is asked instead. A logger that can't say is assumed to log.
func debugEnabled(ctx context.Context, logger logging.Logger) bool {
	switch l := logger.(type) {
	case interface {
		Enabled(context.Context, slog.Level) bool
	}:
		return l.Enabled(ctx, slog.LevelDebug)
	case *logging.SLogLogger:
		return l.Logger.Enabled(ctx, slog.LevelDebug)
	case *logging.NoOpLogger:
		return false
	}
	return true
}

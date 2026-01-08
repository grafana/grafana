package server

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// requestsTotal counts total HTTP requests with labels for method, path, and status.
	requestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auditlog_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	// requestDuration measures HTTP request duration in seconds.
	requestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "auditlog_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// logsReceivedTotal counts total log records processed.
	logsReceivedTotal = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "auditlog_logs_received_total",
			Help: "Total number of log records received",
		},
	)
)

// responseWriter wraps http.ResponseWriter to capture status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
	}
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// MetricsMiddleware wraps an HTTP handler to record request metrics.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		wrapped := newResponseWriter(w)
		next.ServeHTTP(wrapped, r)

		duration := time.Since(start).Seconds()
		path := normalizePath(r.URL.Path)

		requestsTotal.WithLabelValues(r.Method, path, strconv.Itoa(wrapped.statusCode)).Inc()
		requestDuration.WithLabelValues(r.Method, path).Observe(duration)
	})
}

// normalizePath normalizes the URL path to prevent high cardinality.
func normalizePath(path string) string {
	switch path {
	case "/health", "/auditlog", "/v1/logs", "/metrics":
		return path
	default:
		return "other"
	}
}

// RecordLogsReceived increments the logs received counter.
func RecordLogsReceived(count int) {
	logsReceivedTotal.Add(float64(count))
}

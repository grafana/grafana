package server

import (
	"log/slog"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Server is the audit log HTTP server.
type Server struct {
	logger  *slog.Logger
	handler *Handler
}

// New creates a new audit log server.
func New(logger *slog.Logger) *Server {
	return &Server{
		logger:  logger,
		handler: NewHandler(logger),
	}
}

// Handler returns the HTTP handler for the server.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// Prometheus metrics endpoint
	mux.Handle("GET /metrics", promhttp.Handler())

	// OTLP logs endpoint - accepts both protobuf and JSON
	// Support both custom /auditlog path and standard OTLP /v1/logs path
	mux.HandleFunc("POST /auditlog", s.handler.HandleAuditLog)
	mux.HandleFunc("POST /v1/logs", s.handler.HandleAuditLog)

	// Wrap with metrics middleware
	return MetricsMiddleware(mux)
}

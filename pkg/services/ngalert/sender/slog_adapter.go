package sender

import (
	"context"
	"log/slog"

	"github.com/grafana/grafana/pkg/infra/log"
)

// InfraLoggerHandler adapts infra's log.Logger to an slog.Handler
type InfraLoggerHandler struct {
	infraLogger log.Logger
}

type SlogAdapter struct {
	logger *slog.Logger
}

// Log implements the Log method to satisfy the log.Logger interface.
func (s *SlogAdapter) Log(keyvals ...interface{}) error {
	msg := ""
	args := []interface{}{}

	// Extract message and attributes (customize as needed).
	if len(keyvals) > 0 {
		msg, _ = keyvals[0].(string)
		if len(keyvals) > 1 {
			args = keyvals[1:]
		}
	}

	// Delegate to slog.Logger
	s.logger.Info(msg, args...)
	return nil
}

// Enabled determines if the log level is enabled
func (h *InfraLoggerHandler) Enabled(_ context.Context, level slog.Level) bool {
	// Assume all levels are enabled; customize this based on infra's log.Logger
	return true
}

// Handle processes a log record and routes it to infra's log.Logger
func (h *InfraLoggerHandler) Handle(_ context.Context, record slog.Record) error {
	// Build the log message
	msg := record.Message
	args := []interface{}{}
	record.Attrs(func(a slog.Attr) bool {
		args = append(args, a.Key, a.Value.Any())
		return true
	})

	// Route the log message to Infra's logger
	switch record.Level {
	case slog.LevelDebug:
		h.infraLogger.Debug(msg, args...)
	case slog.LevelInfo:
		h.infraLogger.Info(msg, args...)
	case slog.LevelWarn:
		h.infraLogger.Warn(msg, args...)
	case slog.LevelError:
		h.infraLogger.Error(msg, args...)
	}

	return nil
}

// WithAttrs adds attributes to the logger context
func (h *InfraLoggerHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return h // Context attributes are ignored; implement if needed
}

// WithGroup groups log records; not used here
func (h *InfraLoggerHandler) WithGroup(name string) slog.Handler {
	return h // Grouping is ignored; implement if needed
}

// toSlogLogger is a function to create *slog.Logger from Infra's log.Logger
func toSlogLogger(infraLogger log.Logger) *slog.Logger {
	handler := &InfraLoggerHandler{infraLogger: infraLogger}
	return slog.New(handler)
}

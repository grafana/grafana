package auditing

import (
	"context"
	"encoding/json"
	"time"
)

// Sinkable is a log entry abstraction that can be sent to an audit log sink through the different implementing methods.
type Sinkable interface {
	json.Marshaler
	KVPairs() []any
	Time() time.Time
}

// Logger specifies the contract for a specific audit logger.
type Logger interface {
	Log(entry Sinkable) error
	Close() error
	Type() string
}

// Implementation inspired by https://github.com/grafana/grafana-app-sdk/blob/main/logging/logger.go
type loggerContextKey struct{}

var (
	// DefaultLogger is the default Logger if one hasn't been provided in the context.
	// You may use this to add arbitrary audit logging outside of an API request lifecycle.
	DefaultLogger Logger = &NoopLogger{}

	contextKey = loggerContextKey{}
)

// FromContext returns the Logger set in the context with Context(), or the DefaultLogger if no Logger is set in the context.
// If DefaultLogger is nil, it returns a *NoopLogger so that the return is always valid to call methods on without nil-checking.
// You may use this to add arbitrary audit logging outside of an API request lifecycle.
func FromContext(ctx context.Context) Logger {
	if l := ctx.Value(contextKey); l != nil {
		if logger, ok := l.(Logger); ok {
			return logger
		}
	}

	if DefaultLogger != nil {
		return DefaultLogger
	}

	return &NoopLogger{}
}

// Context returns a new context built from the provided context with the provided logger in it.
// The Logger added with Context() can be retrieved with FromContext()
func Context(ctx context.Context, logger Logger) context.Context {
	return context.WithValue(ctx, contextKey, logger)
}

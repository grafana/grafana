package log

import "context"

type Lvl int

const (
	LvlCrit Lvl = iota
	LvlError
	LvlWarn
	LvlInfo
	LvlDebug
)

type Logger interface {
	// New returns a new contextual Logger that has this logger's context plus the given context.
	New(ctx ...any) *ConcreteLogger

	Log(keyvals ...any) error

	// Debug logs a message with debug level and key/value pairs, if any.
	Debug(msg string, ctx ...any)

	// Info logs a message with info level and key/value pairs, if any.
	Info(msg string, ctx ...any)

	// Warn logs a message with warning level and key/value pairs, if any.
	Warn(msg string, ctx ...any)

	// Error logs a message with error level and key/value pairs, if any.
	Error(msg string, ctx ...any)

	// FromContext returns a new contextual Logger that has this logger's context plus the given context.
	FromContext(ctx context.Context) Logger
}

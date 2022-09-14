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
	New(ctx ...interface{}) *ConcreteLogger

	Log(keyvals ...interface{}) error

	// Debug logs a message with debug level and key/value pairs, if any.
	Debug(msg string, ctx ...interface{})

	// Info logs a message with info level and key/value pairs, if any.
	Info(msg string, ctx ...interface{})

	// Warn logs a message with warning level and key/value pairs, if any.
	Warn(msg string, ctx ...interface{})

	// Error logs a message with error level and key/value pairs, if any.
	Error(msg string, ctx ...interface{})

	// DebugCtx logs a message with debug level and key/value pairs, if any.
	// In addition adds context key/value pairs, if any,
	DebugCtx(ctx context.Context, msg string, args ...interface{})

	// InfoCtx logs a message with info level and key/value pairs, if any.
	// In addition adds context key/value pairs, if any,
	InfoCtx(ctx context.Context, msg string, args ...interface{})

	// WarnCtx logs a message with warning level and key/value pairs, if any.
	// In addition adds context key/value pairs, if any,
	WarnCtx(ctx context.Context, msg string, args ...interface{})

	// ErrorCtx logs a message with error level and key/value pairs, if any.
	// In addition adds context key/value pairs, if any,
	ErrorCtx(ctx context.Context, msg string, args ...interface{})
}

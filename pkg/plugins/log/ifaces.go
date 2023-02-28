package log

// Logger is the default logger
type Logger interface {
	// New returns a new contextual Logger that has this logger's context plus the given context.
	New(ctx ...interface{}) Logger

	// Debug logs a message with debug level and key/value pairs, if any.
	Debug(msg string, ctx ...interface{})

	// Info logs a message with info level and key/value pairs, if any.
	Info(msg string, ctx ...interface{})

	// Warn logs a message with warning level and key/value pairs, if any.
	Warn(msg string, ctx ...interface{})

	// Error logs a message with error level and key/value pairs, if any.
	Error(msg string, ctx ...interface{})
}

// PrettyLogger is used primarily to facilitate logging/user feedback for both
// the grafana-cli and the grafana backend when managing plugin installs
type PrettyLogger interface {
	Successf(format string, args ...interface{})
	Failuref(format string, args ...interface{})

	Info(args ...interface{})
	Infof(format string, args ...interface{})
	Debug(args ...interface{})
	Debugf(format string, args ...interface{})
	Warn(args ...interface{})
	Warnf(format string, args ...interface{})
	Error(args ...interface{})
	Errorf(format string, args ...interface{})
}

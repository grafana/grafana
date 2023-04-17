package grpcplugin

import (
	"fmt"
	"io"
	"log"

	"github.com/hashicorp/go-hclog"

	plog "github.com/grafana/grafana/pkg/plugins/log"
)

type logWrapper struct {
	Logger plog.Logger

	name        string
	impliedArgs []interface{}
}

func formatArgs(args ...interface{}) []interface{} {
	if len(args) == 0 || len(args)%2 != 0 {
		return args
	}

	res := []interface{}{}

	for n := 0; n < len(args); n += 2 {
		key := args[n]

		if stringKey, ok := key.(string); ok && stringKey == "timestamp" {
			continue
		}

		res = append(res, key)
		res = append(res, args[n+1])
	}

	return res
}

// Emit a message and key/value pairs at a provided log level
func (lw logWrapper) Log(level hclog.Level, msg string, args ...interface{}) {
	switch level {
	case hclog.Trace:
		lw.Trace(msg, args...)
	case hclog.Debug:
		lw.Debug(msg, args...)
	case hclog.Info:
		lw.Info(msg, args...)
	case hclog.Warn:
		lw.Warn(msg, args...)
	case hclog.Error:
		lw.Error(msg, args...)
	default:
		// TODO: Handle hclog.NoLevel
	}
}

// Emit a message and key/value pairs at the TRACE level
func (lw logWrapper) Trace(msg string, args ...interface{}) {
	lw.Logger.Debug(msg, formatArgs(args...)...)
}

// Emit a message and key/value pairs at the DEBUG level
func (lw logWrapper) Debug(msg string, args ...interface{}) {
	lw.Logger.Debug(msg, formatArgs(args...)...)
}

// Emit a message and key/value pairs at the INFO level
func (lw logWrapper) Info(msg string, args ...interface{}) {
	lw.Logger.Info(msg, formatArgs(args...)...)
}

// Emit a message and key/value pairs at the WARN level
func (lw logWrapper) Warn(msg string, args ...interface{}) {
	lw.Logger.Warn(msg, formatArgs(args...)...)
}

// Emit a message and key/value pairs at the ERROR level
func (lw logWrapper) Error(msg string, args ...interface{}) {
	lw.Logger.Error(msg, formatArgs(args...)...)
}

// Indicate if TRACE logs would be emitted.
func (lw logWrapper) IsTrace() bool { return true }

// Indicate if DEBUG logs would be emitted.
func (lw logWrapper) IsDebug() bool { return true }

// Indicate if INFO logs would be emitted.
func (lw logWrapper) IsInfo() bool { return true }

// Indicate if WARN logs would be emitted.
func (lw logWrapper) IsWarn() bool { return true }

// Indicate if ERROR logs would be emitted.
func (lw logWrapper) IsError() bool { return true }

// ImpliedArgs returns With key/value pairs
func (lw logWrapper) ImpliedArgs() []interface{} {
	return lw.impliedArgs
}

// Creates a sublogger that will always have the given key/value pairs
func (lw logWrapper) With(args ...interface{}) hclog.Logger {
	return logWrapper{
		Logger:      lw.Logger.New(args...),
		name:        lw.name,
		impliedArgs: args,
	}
}

// Returns the Name of the logger
func (lw logWrapper) Name() string {
	return lw.name
}

// Create a logger that will prepend the name string on the front of all messages.
// If the logger already has a name, the new value will be appended to the current
// name.
func (lw logWrapper) Named(name string) hclog.Logger {
	if name == "stdio" {
		// discard logs from stdio hashicorp/go-plugin gRPC service since
		// it's not enabled/in use per default.
		// discard debug log of "waiting for stdio data".
		// discard warn log of "received EOF, stopping recv loop".
		return hclog.NewNullLogger()
	}

	if lw.name != "" {
		name = fmt.Sprintf("%s.%s", lw.name, name)
	}

	return logWrapper{
		Logger:      lw.Logger.New(),
		name:        name,
		impliedArgs: lw.impliedArgs,
	}
}

// Create a logger that will prepend the name string on the front of all messages.
// This sets the name of the logger to the value directly, unlike Named which honor
// the current name as well.
func (lw logWrapper) ResetNamed(name string) hclog.Logger {
	return logWrapper{
		Logger:      lw.Logger.New(),
		name:        name,
		impliedArgs: lw.impliedArgs,
	}
}

// No-op. The wrapped logger implementation cannot update the level on the fly.
func (lw logWrapper) SetLevel(level hclog.Level) {}

// Return a value that conforms to the stdlib log.Logger interface
func (lw logWrapper) StandardLogger(ops *hclog.StandardLoggerOptions) *log.Logger {
	return nil
}

// Return a value that conforms to io.Writer, which can be passed into log.SetOutput()
func (lw logWrapper) StandardWriter(opts *hclog.StandardLoggerOptions) io.Writer {
	return io.Discard
}

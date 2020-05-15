package backendplugin

import (
	"io"
	"io/ioutil"
	"log"

	glog "github.com/grafana/grafana/pkg/infra/log"
	hclog "github.com/hashicorp/go-hclog"
)

type logWrapper struct {
	Logger glog.Logger
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

func (lw logWrapper) Trace(msg string, args ...interface{}) {
	lw.Logger.Debug(msg, formatArgs(args...)...)
}
func (lw logWrapper) Debug(msg string, args ...interface{}) {
	lw.Logger.Debug(msg, formatArgs(args...)...)
}
func (lw logWrapper) Info(msg string, args ...interface{}) {
	lw.Logger.Info(msg, formatArgs(args...)...)
}
func (lw logWrapper) Warn(msg string, args ...interface{}) {
	lw.Logger.Warn(msg, formatArgs(args...)...)
}
func (lw logWrapper) Error(msg string, args ...interface{}) {
	lw.Logger.Error(msg, formatArgs(args...)...)
}

func (lw logWrapper) IsTrace() bool { return true }
func (lw logWrapper) IsDebug() bool { return true }
func (lw logWrapper) IsInfo() bool  { return true }
func (lw logWrapper) IsWarn() bool  { return true }
func (lw logWrapper) IsError() bool { return true }

func (lw logWrapper) With(args ...interface{}) hclog.Logger {
	return logWrapper{Logger: lw.Logger.New(args...)}
}
func (lw logWrapper) Named(name string) hclog.Logger {
	if name == "stdio" {
		// discard logs from stdio hashicorp/go-plugin gRPC service since
		// it's not enabled/in use per default.
		// discard debug log of "waiting for stdio data".
		// discard warn log of "received EOF, stopping recv loop".
		return hclog.NewNullLogger()
	}
	return logWrapper{
		Logger: lw.Logger.New(),
	}
}

func (lw logWrapper) ResetNamed(name string) hclog.Logger {
	return logWrapper{Logger: lw.Logger.New()}
}

func (lw logWrapper) StandardLogger(ops *hclog.StandardLoggerOptions) *log.Logger {
	return nil
}

func (lw logWrapper) SetLevel(level hclog.Level) {}

// Return a value that conforms to io.Writer, which can be passed into log.SetOutput()
func (lw logWrapper) StandardWriter(opts *hclog.StandardLoggerOptions) io.Writer {
	return ioutil.Discard
}

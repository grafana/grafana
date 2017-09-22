package backend

import (
	"log"

	glog "github.com/grafana/grafana/pkg/log"
	hclog "github.com/hashicorp/go-hclog"
)

type LogWrapper struct {
	Logger glog.Logger
}

func (lw LogWrapper) Trace(msg string, args ...interface{}) {}
func (lw LogWrapper) Debug(msg string, args ...interface{}) {}
func (lw LogWrapper) Info(msg string, args ...interface{})  {}
func (lw LogWrapper) Warn(msg string, args ...interface{})  {}
func (lw LogWrapper) Error(msg string, args ...interface{}) {}

func (lw LogWrapper) IsTrace() bool { return true }
func (lw LogWrapper) IsDebug() bool { return true }
func (lw LogWrapper) IsInfo() bool  { return true }
func (lw LogWrapper) IsWarn() bool  { return true }
func (lw LogWrapper) IsError() bool { return true }

func (lw LogWrapper) With(args ...interface{}) hclog.Logger {
	return LogWrapper{Logger: glog.New("logger", args)}
}
func (lw LogWrapper) Named(name string) hclog.Logger {
	return LogWrapper{Logger: glog.New(name)}
}
func (lw LogWrapper) ResetNamed(name string) hclog.Logger {
	return LogWrapper{Logger: glog.New(name)}
}

func (lw LogWrapper) StandardLogger(ops *hclog.StandardLoggerOptions) *log.Logger {
	return nil
}

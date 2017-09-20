package plugins

import (
	"log"

	glog "github.com/grafana/grafana/pkg/log"
	hclog "github.com/hashicorp/go-hclog"
)

type logWrapper struct {
	logger glog.Logger
}

func (lw logWrapper) Trace(msg string, args ...interface{}) {}
func (lw logWrapper) Debug(msg string, args ...interface{}) {}
func (lw logWrapper) Info(msg string, args ...interface{})  {}
func (lw logWrapper) Warn(msg string, args ...interface{})  {}
func (lw logWrapper) Error(msg string, args ...interface{}) {}

func (lw logWrapper) IsTrace() bool { return true }
func (lw logWrapper) IsDebug() bool { return true }
func (lw logWrapper) IsInfo() bool  { return true }
func (lw logWrapper) IsWarn() bool  { return true }
func (lw logWrapper) IsError() bool { return true }

func (lw logWrapper) With(args ...interface{}) hclog.Logger {
	return logWrapper{logger: glog.New("logger", args)}
}
func (lw logWrapper) Named(name string) hclog.Logger {
	return logWrapper{logger: glog.New(name)}
}
func (lw logWrapper) ResetNamed(name string) hclog.Logger {
	return logWrapper{logger: glog.New(name)}
}

func (lw logWrapper) StandardLogger(ops *hclog.StandardLoggerOptions) *log.Logger {
	return nil
}

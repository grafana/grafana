package logger

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
)

type InfraLogWrapper struct {
	log log.Logger
}

func NewLogger(name string) (l *InfraLogWrapper) {
	return &InfraLogWrapper{
		log: log.New(name),
	}
}

func (l *InfraLogWrapper) Successf(format string, args ...interface{}) {
	l.log.Info(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Failuref(format string, args ...interface{}) {
	l.log.Error(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Info(args ...interface{}) {
	l.log.Info(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Infof(format string, args ...interface{}) {
	l.log.Info(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Debug(args ...interface{}) {
	l.log.Debug(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Debugf(format string, args ...interface{}) {
	l.log.Debug(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Warn(args ...interface{}) {
	l.log.Warn(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Warnf(format string, args ...interface{}) {
	l.log.Warn(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Error(args ...interface{}) {
	l.log.Error(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Errorf(format string, args ...interface{}) {
	l.log.Error(fmt.Sprintf(format, args...))
}

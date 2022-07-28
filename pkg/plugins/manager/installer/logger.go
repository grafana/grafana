package installer

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
)

type InfraLogWrapper struct {
	l log.Logger
}

func NewLogger(name string) (l *InfraLogWrapper) {
	return &InfraLogWrapper{
		l: log.New(name),
	}
}

func (l *InfraLogWrapper) Successf(format string, args ...interface{}) {
	l.l.Info(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Failuref(format string, args ...interface{}) {
	l.l.Error(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Info(args ...interface{}) {
	l.l.Info(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Infof(format string, args ...interface{}) {
	l.l.Info(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Debug(args ...interface{}) {
	l.l.Debug(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Debugf(format string, args ...interface{}) {
	l.l.Debug(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Warn(args ...interface{}) {
	l.l.Warn(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Warnf(format string, args ...interface{}) {
	l.l.Warn(fmt.Sprintf(format, args...))
}

func (l *InfraLogWrapper) Error(args ...interface{}) {
	l.l.Error(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Errorf(format string, args ...interface{}) {
	l.l.Error(fmt.Sprintf(format, args...))
}

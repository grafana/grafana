package logger

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
)

type Logger interface {
	Success(message string, args ...interface{})
	Failure(message string, args ...interface{})

	Info(args ...interface{})
	Debug(args ...interface{})
	Warn(args ...interface{})
	Error(args ...interface{})
}

type InfraLogWrapper struct {
	l log.Logger

	debugMode bool
}

func New(name string, debugMode bool) (l *InfraLogWrapper) {
	return &InfraLogWrapper{
		debugMode: debugMode,
		l:         log.New(name),
	}
}

func (l *InfraLogWrapper) Success(message string, args ...interface{}) {
	l.l.Info(message, args...)
}

func (l *InfraLogWrapper) Failure(message string, args ...interface{}) {
	l.l.Error(message, args...)
}

func (l *InfraLogWrapper) Info(args ...interface{}) {
	l.l.Info(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Debug(args ...interface{}) {
	if l.debugMode {
		l.l.Debug(fmt.Sprint(args...))
	}
}

func (l *InfraLogWrapper) Warn(args ...interface{}) {
	l.l.Warn(fmt.Sprint(args...))
}

func (l *InfraLogWrapper) Error(args ...interface{}) {
	l.l.Error(fmt.Sprint(args...))
}

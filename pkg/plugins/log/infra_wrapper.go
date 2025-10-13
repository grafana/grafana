package log

import (
	"fmt"
)

var _ PrettyLogger = (*prettyLogger)(nil)

type prettyLogger struct {
	log Logger
}

func NewPrettyLogger(name string) *prettyLogger {
	return &prettyLogger{
		log: New(name),
	}
}

func (l *prettyLogger) Successf(format string, args ...any) {
	l.log.Info(fmt.Sprintf(format, args...))
}

func (l *prettyLogger) Failuref(format string, args ...any) {
	l.log.Error(fmt.Sprintf(format, args...))
}

func (l *prettyLogger) Info(args ...any) {
	l.log.Info(fmt.Sprint(args...))
}

func (l *prettyLogger) Infof(format string, args ...any) {
	l.log.Info(fmt.Sprintf(format, args...))
}

func (l *prettyLogger) Debug(args ...any) {
	l.log.Debug(fmt.Sprint(args...))
}

func (l *prettyLogger) Debugf(format string, args ...any) {
	l.log.Debug(fmt.Sprintf(format, args...))
}

func (l *prettyLogger) Warn(args ...any) {
	l.log.Warn(fmt.Sprint(args...))
}

func (l *prettyLogger) Warnf(format string, args ...any) {
	l.log.Warn(fmt.Sprintf(format, args...))
}

func (l *prettyLogger) Error(args ...any) {
	l.log.Error(fmt.Sprint(args...))
}

func (l *prettyLogger) Errorf(format string, args ...any) {
	l.log.Error(fmt.Sprintf(format, args...))
}

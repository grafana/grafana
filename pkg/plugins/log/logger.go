package log

import (
	"github.com/grafana/grafana/pkg/infra/log"
)

func New(name string) Logger { //_ ...interface{}
	return &DefaultLogger{
		l: log.New(name),
	}
}

type DefaultLogger struct {
	l *log.ConcreteLogger
}

func (d *DefaultLogger) New(ctx ...interface{}) Logger {
	if len(ctx) == 0 {
		return &DefaultLogger{
			l: d.l.New(),
		}
	}

	ctx = append([]interface{}{"logger"}, ctx...)
	return &DefaultLogger{
		l: d.l.New(ctx...),
	}
}

func (d *DefaultLogger) Debug(msg string, ctx ...interface{}) {
	d.l.Debug(msg, ctx...)
}

func (d *DefaultLogger) Info(msg string, ctx ...interface{}) {
	d.l.Info(msg, ctx...)
}

func (d *DefaultLogger) Warn(msg string, ctx ...interface{}) {
	d.l.Warn(msg, ctx...)
}

func (d *DefaultLogger) Error(msg string, ctx ...interface{}) {
	d.l.Error(msg, ctx...)
}

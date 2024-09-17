package log

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

func New(name string) Logger {
	return &grafanaInfraLogWrapper{
		l: log.New(name),
	}
}

type grafanaInfraLogWrapper struct {
	l *log.ConcreteLogger
}

func (d *grafanaInfraLogWrapper) New(ctx ...any) Logger {
	if len(ctx) == 0 {
		return &grafanaInfraLogWrapper{
			l: d.l.New(),
		}
	}

	return &grafanaInfraLogWrapper{
		l: d.l.New(ctx...),
	}
}

func (d *grafanaInfraLogWrapper) Debug(msg string, ctx ...any) {
	d.l.Debug(msg, ctx...)
}

func (d *grafanaInfraLogWrapper) Info(msg string, ctx ...any) {
	d.l.Info(msg, ctx...)
}

func (d *grafanaInfraLogWrapper) Warn(msg string, ctx ...any) {
	d.l.Warn(msg, ctx...)
}

func (d *grafanaInfraLogWrapper) Error(msg string, ctx ...any) {
	d.l.Error(msg, ctx...)
}

func (d *grafanaInfraLogWrapper) FromContext(ctx context.Context) Logger {
	concreteInfraLogger, ok := d.l.FromContext(ctx).(*log.ConcreteLogger)
	if !ok {
		return d.New()
	}
	return &grafanaInfraLogWrapper{
		l: concreteInfraLogger,
	}
}

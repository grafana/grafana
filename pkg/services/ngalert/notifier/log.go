package notifier

import (
	"github.com/grafana/alerting/alerting/notifier/channels"

	"github.com/grafana/grafana/pkg/infra/log"
)

var LoggerFactory channels.LoggerFactory = func(ctx ...interface{}) channels.Logger {
	return &logWrapper{log.New(ctx...)}
}

type logWrapper struct {
	*log.ConcreteLogger
}

func (l logWrapper) New(ctx ...interface{}) channels.Logger {
	return logWrapper{l.ConcreteLogger.New(ctx...)}
}

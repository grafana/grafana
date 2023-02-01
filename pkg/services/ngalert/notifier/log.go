package notifier

import (
	"github.com/grafana/alerting/logging"

	"github.com/grafana/grafana/pkg/infra/log"
)

var LoggerFactory logging.LoggerFactory = func(ctx ...interface{}) logging.Logger {
	return &logWrapper{log.New(ctx...)}
}

type logWrapper struct {
	*log.ConcreteLogger
}

func (l logWrapper) New(ctx ...interface{}) logging.Logger {
	return logWrapper{l.ConcreteLogger.New(ctx...)}
}

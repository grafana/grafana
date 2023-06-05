package notifier

import (
	alertingLogging "github.com/grafana/alerting/logging"

	"github.com/grafana/grafana/pkg/infra/log"
)

var LoggerFactory alertingLogging.LoggerFactory = func(ctx ...interface{}) alertingLogging.Logger {
	return &logWrapper{log.New(ctx...)}
}

type logWrapper struct {
	*log.ConcreteLogger
}

func (l logWrapper) New(ctx ...interface{}) alertingLogging.Logger {
	return logWrapper{l.ConcreteLogger.New(ctx...)}
}

package notifier

import (
	alertingLogging "github.com/grafana/alerting/logging"

	"github.com/grafana/grafana/pkg/infra/log"
)

var LoggerFactory alertingLogging.LoggerFactory = func(logger string, ctx ...any) alertingLogging.Logger {
	return &logWrapper{log.New(append([]any{logger}, ctx...)...)}
}

func newLogWrapper(logger log.Logger, ctx ...any) alertingLogging.Logger {
	return &logWrapper{logger.New(ctx...)}
}

type logWrapper struct {
	*log.ConcreteLogger
}

func (l logWrapper) New(ctx ...any) alertingLogging.Logger {
	return logWrapper{l.ConcreteLogger.New(ctx...)}
}

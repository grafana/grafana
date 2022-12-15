package notifier

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
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

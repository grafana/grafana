package grafanats

import (
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
)

var (
	natsLogger = log.New("nats")
)

type LogAdapter struct{}

func (l LogAdapter) Noticef(format string, v ...interface{}) {
	natsLogger.Info(fmt.Sprintf(format, v...))
}

func (l LogAdapter) Warnf(format string, v ...interface{}) {
	natsLogger.Warn(fmt.Sprintf(format, v...))
}

func (l LogAdapter) Fatalf(format string, v ...interface{}) {
	natsLogger.Crit(fmt.Sprintf(format, v...))
	os.Exit(1)
}

func (l LogAdapter) Errorf(format string, v ...interface{}) {
	natsLogger.Error(fmt.Sprintf(format, v...))
}

func (l LogAdapter) Debugf(format string, v ...interface{}) {
	natsLogger.Debug(fmt.Sprintf(format, v...))
}

func (l LogAdapter) Tracef(format string, v ...interface{}) {
	natsLogger.Debug(fmt.Sprintf(format, v...))
}

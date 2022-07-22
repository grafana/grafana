package azlog

import "github.com/grafana/grafana/pkg/infra/log"

var (
	azlog = log.New("tsdb.azuremonitor")
)

func Warn(msg string, args ...interface{}) {
	azlog.Warn(msg, args)
}

func Debug(msg string, args ...interface{}) {
	azlog.Debug(msg, args)
}

func Error(msg string, args ...interface{}) {
	azlog.Error(msg, args)
}

func Info(msg string, args ...interface{}) {
	azlog.Info(msg, args)
}

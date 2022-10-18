package cwlog

import "github.com/grafana/grafana/pkg/infra/log"

var (
	cwlog = log.New("tsdb.cloudwatch")
)

func Warn(msg string, args ...interface{}) {
	cwlog.Warn(msg, args)
}

func Debug(msg string, args ...interface{}) {
	cwlog.Debug(msg, args)
}

func Error(msg string, args ...interface{}) {
	cwlog.Error(msg, args)
}

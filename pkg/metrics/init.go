package metrics

import (
	"context"

	ini "gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics/graphitebridge"
)

var metricsLogger log.Logger = log.New("metrics")

type logWrapper struct {
	logger log.Logger
}

func (lw *logWrapper) Println(v ...interface{}) {
	lw.logger.Info("graphite metric bridge", v...)
}

func Init(file *ini.File) {
	cfg := ReadSettings(file)
	internalInit(cfg)
}

func internalInit(settings *MetricSettings) {
	initMetricVars(settings)

	if settings.GraphiteBridgeConfig != nil {
		bridge, err := graphitebridge.NewBridge(settings.GraphiteBridgeConfig)
		if err != nil {
			metricsLogger.Error("failed to create graphite bridge", "error", err)
		} else {
			go bridge.Run(context.Background())
		}
	}
}

package metrics

import (
	"context"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics/graphitepublisher"
)

var metricsLogger log.Logger = log.New("metrics")
var metricPublishCounter int64 = 0

type logWrapper struct {
	logger log.Logger
}

func (lw *logWrapper) Println(v ...interface{}) {
	lw.logger.Info("graphite metric bridge", v...)
}

func Init(settings *MetricSettings) {
	initMetricVars(settings)

	if settings.GraphiteBridgeConfig != nil {
		bridge, err := graphitepublisher.NewBridge(settings.GraphiteBridgeConfig)
		if err != nil {
			metricsLogger.Error("failed to create graphite bridge", "error", err)
		} else {
			go bridge.Run(context.Background())
		}
	}
}

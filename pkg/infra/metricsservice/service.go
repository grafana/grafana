package metricsservice

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/metrics/graphitebridge"
	"github.com/grafana/grafana/pkg/setting"
)

var metricsLogger log.Logger = log.New("metrics")

type logWrapper struct {
	logger log.Logger
}

func (lw *logWrapper) Println(v ...any) {
	lw.logger.Info("graphite metric bridge", v...)
}

func ProvideService(cfg *setting.Cfg, reg prometheus.Registerer, gatherer prometheus.Gatherer) (*InternalMetricsService, error) {
	metrics.Register(reg)

	s := &InternalMetricsService{
		Cfg:      cfg,
		gatherer: gatherer,
	}
	return s, s.readSettings()
}

type InternalMetricsService struct {
	Cfg *setting.Cfg

	intervalSeconds int64
	graphiteCfg     *graphitebridge.Config
	gatherer        prometheus.Gatherer
}

func (im *InternalMetricsService) Run(ctx context.Context) error {
	// Start Graphite Bridge
	if im.graphiteCfg != nil {
		bridge, err := graphitebridge.NewBridge(im.graphiteCfg)
		if err != nil {
			metricsLogger.Error("failed to create graphite bridge", "error", err)
		} else {
			go bridge.Run(ctx)
		}
	}

	metrics.MInstanceStart.Inc()

	<-ctx.Done()
	return ctx.Err()
}

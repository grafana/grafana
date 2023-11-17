package metrics

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/component-base/metrics/legacyregistry"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/graphitebridge"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type Registry interface {
	prometheus.Registerer
	prometheus.Gatherer
}

type registry struct {
	Registry
}

var metricsLogger log.Logger = log.New("metrics")

type logWrapper struct {
	logger log.Logger
}

func (lw *logWrapper) Println(v ...any) {
	lw.logger.Info("graphite metric bridge", v...)
}

func ProvideService(cfg *setting.Cfg, reg prometheus.Registerer) (*InternalMetricsService, error) {
	initMetricVars(reg)
	initFrontendMetrics(reg)

	s := &InternalMetricsService{
		Cfg: cfg,
	}
	return s, s.readSettings()
}

type InternalMetricsService struct {
	Cfg *setting.Cfg

	intervalSeconds int64
	graphiteCfg     *graphitebridge.Config
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

	MInstanceStart.Inc()

	<-ctx.Done()
	return ctx.Err()
}

func ProvideRegistry(cfg *setting.Cfg) *registry {
	if cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrafanaAPIServer) {
		return &registry{legacyregistry.Registerer().(Registry)}
	}
	return &registry{prometheus.DefaultRegisterer.(Registry)}
}

func ProvideRegistryForTest() *registry {
	return &registry{prometheus.NewRegistry()}
}

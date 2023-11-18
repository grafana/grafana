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

func ProvideRegisterer(cfg *setting.Cfg) prometheus.Registerer {
	if cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrafanaAPIServer) {
		return legacyregistry.Registerer()
	}
	return prometheus.DefaultRegisterer
}

func ProvideGatherer(cfg *setting.Cfg) prometheus.Gatherer {
	if cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrafanaAPIServer) {
		return legacyregistry.DefaultGatherer
	}
	return prometheus.DefaultGatherer
}

func ProvideRegistererForTest() prometheus.Registerer {
	return prometheus.NewRegistry()
}

func ProvideGathererForTest(reg prometheus.Registerer) prometheus.Gatherer {
	// the registerer provided by ProvideRegistererForTest
	// is a *prometheus.Registry, so it also implements prometheus.Gatherer
	return reg.(*prometheus.Registry)
}

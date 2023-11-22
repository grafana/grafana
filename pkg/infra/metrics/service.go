package metrics

import (
	"context"
	"errors"
	"regexp"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
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
		return newK8sGathererWrapper(legacyregistry.DefaultGatherer)
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

type k8sGathererWrapper struct {
	orig prometheus.Gatherer
	reg  *regexp.Regexp
}

func newK8sGathererWrapper(orig prometheus.Gatherer) *k8sGathererWrapper {
	return &k8sGathererWrapper{
		orig: orig,
		reg:  regexp.MustCompile("^((?:grafana|go).*)"),
	}
}

func (g *k8sGathererWrapper) Gather() ([]*dto.MetricFamily, error) {
	mf, err := g.orig.Gather()
	if err != nil {
		return nil, err
	}

	names := make(map[string]struct{})

	for i := 0; i < len(mf); i++ {
		m := mf[i]
		if m.Name != nil && !g.reg.MatchString(*m.Name) {
			*m.Name = "grafana_" + *m.Name
			// since we are modifying the name, we need to check for duplicates in the gatherer
			if _, exists := names[*m.Name]; exists {
				return nil, errors.New("duplicate metric name: " + *m.Name)
			}
		}
		// keep track of names to detect duplicates
		names[*m.Name] = struct{}{}
	}

	return mf, nil
}

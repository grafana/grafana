package metrics

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"k8s.io/component-base/metrics/legacyregistry"

	"github.com/grafana/grafana/pkg/infra/log"
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
	initMetricVars(reg)
	initFrontendMetrics(reg)

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

	MInstanceStart.Inc()

	<-ctx.Done()
	return ctx.Err()
}

func ProvideRegisterer() prometheus.Registerer {
	return legacyregistry.Registerer()
}

func ProvideGatherer() prometheus.Gatherer {
	k8sGatherer := newAddPrefixWrapper(legacyregistry.DefaultGatherer)
	return NewMultiRegistry(k8sGatherer, prometheus.DefaultGatherer)
}

func ProvideRegistererForTest() prometheus.Registerer {
	return prometheus.NewRegistry()
}

func ProvideGathererForTest(reg prometheus.Registerer) prometheus.Gatherer {
	// the registerer provided by ProvideRegistererForTest
	// is a *prometheus.Registry, so it also implements prometheus.Gatherer
	return reg.(*prometheus.Registry)
}

var _ prometheus.Gatherer = (*addPrefixWrapper)(nil)

// addPrefixWrapper wraps a prometheus.Gatherer, and ensures that all metric names are prefixed with `grafana_`.
// metrics with the prefix `grafana_` or `go_` are not modified.
type addPrefixWrapper struct {
	orig prometheus.Gatherer
	reg  *regexp.Regexp
}

func newAddPrefixWrapper(orig prometheus.Gatherer) *addPrefixWrapper {
	return &addPrefixWrapper{
		orig: orig,
		reg:  regexp.MustCompile("^((?:grafana_|go_).*)"),
	}
}

func (g *addPrefixWrapper) Gather() ([]*dto.MetricFamily, error) {
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
				return nil, fmt.Errorf("duplicate metric name: %s", *m.Name)
			}
		}
		// keep track of names to detect duplicates
		names[*m.Name] = struct{}{}
	}

	return mf, nil
}

var _ prometheus.Gatherer = (*multiRegistry)(nil)

type multiRegistry struct {
	denyList  map[string]struct{}
	gatherers []prometheus.Gatherer
}

func NewMultiRegistry(gatherers ...prometheus.Gatherer) *multiRegistry {
	denyList := map[string]struct{}{
		"grafana_apiserver_request_slo_duration_seconds_bucket": {},
	}
	return &multiRegistry{
		denyList:  denyList,
		gatherers: gatherers,
	}
}

func (r *multiRegistry) Gather() (mfs []*dto.MetricFamily, err error) {
	errs := prometheus.MultiError{}

	names := make(map[string]struct{})
	for _, g := range r.gatherers {
		mf, err := g.Gather()
		errs.Append(err)

		for i := 0; i < len(mf); i++ {
			m := mf[i]
			// skip metrics in the deny list
			if _, denied := r.denyList[*m.Name]; denied {
				continue
			}
			// prevent duplicate metric names
			if _, exists := names[*m.Name]; exists {
				// we can skip go_ and process_ metrics without returning an error
				// because they are known to be duplicates in both
				// the k8s and prometheus gatherers.
				if strings.HasPrefix(*m.Name, "go_") || strings.HasPrefix(*m.Name, "process_") {
					continue
				}
				errs = append(errs, fmt.Errorf("duplicate metric name: %s", *m.Name))
				continue
			}
			names[*m.Name] = struct{}{}
			mfs = append(mfs, m)
		}
	}

	sort.Slice(mfs, func(i, j int) bool {
		return *mfs[i].Name < *mfs[j].Name
	})

	return mfs, errs.MaybeUnwrap()
}

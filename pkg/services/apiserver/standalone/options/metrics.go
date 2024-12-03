package options

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/spf13/pflag"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

type MetricsOptions struct {
	logger                  log.Logger
	Enabled                 bool
	DefaultGathererRequired bool

	UseK8sProvidedMetricHandling bool
	MetricsRegisterer            prometheus.Registerer
	MetricsGatherer              prometheus.Gatherer
}

func NewMetricsOptions(logger log.Logger) *MetricsOptions {
	return &MetricsOptions{
		logger: logger,
	}
}

func (o *MetricsOptions) AddFlags(fs *pflag.FlagSet) {
	fs.BoolVar(&o.Enabled, "grafana.metrics.enable", false, "Enable metrics and Prometheus /metrics endpoint.")
	fs.BoolVar(&o.DefaultGathererRequired, "grafana.metrics.include.default", false, "Include metrics from prometheus.DefaultGatherer.")
}

func (o *MetricsOptions) Validate() []error {
	return nil
}

func (o *MetricsOptions) ApplyTo(c *genericapiserver.RecommendedConfig) error {
	// We should defer to k8s to enable the metrics endpoint when the prometheus.DefaultGatherer is not required
	o.UseK8sProvidedMetricHandling = !o.DefaultGathererRequired
	c.EnableMetrics = o.Enabled && o.UseK8sProvidedMetricHandling

	o.MetricsRegisterer = metrics.ProvideRegisterer()
	if o.DefaultGathererRequired {
		o.MetricsGatherer = metrics.ProvideMultiGatherer()
	} else {
		o.MetricsGatherer = metrics.ProvideGatherer()
	}

	metrics.SetBuildInformation(o.MetricsRegisterer, setting.BuildVersion, setting.BuildCommit, setting.BuildBranch, setting.BuildStamp)

	if o.Enabled {
		o.logger.Debug("Metrics enabled")
	}

	return nil
}

func (o *MetricsOptions) CustomHandlerRequired() bool {
	return o.Enabled && o.DefaultGathererRequired
}

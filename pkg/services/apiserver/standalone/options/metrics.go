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
	logger            log.Logger
	Enabled           bool
	MetricsRegisterer prometheus.Registerer
}

func NewMetricsOptions(logger log.Logger) *MetricsOptions {
	return &MetricsOptions{
		logger: logger,
	}
}

func (o *MetricsOptions) AddFlags(fs *pflag.FlagSet) {
	fs.BoolVar(&o.Enabled, "grafana.metrics.enable", false, "Enable metrics and Prometheus /metrics endpoint.")
}

func (o *MetricsOptions) Validate() []error {
	return nil
}

func (o *MetricsOptions) ApplyTo(c *genericapiserver.RecommendedConfig) error {
	c.EnableMetrics = o.Enabled
	o.MetricsRegisterer = metrics.ProvideRegisterer()
	metrics.SetBuildInformation(o.MetricsRegisterer, setting.BuildVersion, setting.BuildCommit, setting.BuildBranch, setting.BuildStamp)

	if o.Enabled {
		o.logger.Debug("Metrics enabled")
	}

	return nil
}

package sources

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
)

var (
	tracer = otel.Tracer("github.com/grafana/grafana/pkg/plugins/manager/sources")

	installRequestCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "plugins",
		Name:      "install_total",
		Help:      "The total amount of plugin installations",
	}, []string{"plugin_id", "version"})

	installRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "plugins",
		Name:      "install_duration_seconds",
		Help:      "Plugin installation duration",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
	}, []string{"plugin_id", "version"})
)

type PluginDownloader interface {
	Download(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error)
}

// RegisterMetrics registers Prometheus metrics for install sources
func RegisterMetrics(reg prometheus.Registerer) error {
	if err := reg.Register(installRequestCounter); err != nil {
		return err
	}
	if err := reg.Register(installRequestDuration); err != nil {
		return err
	}
	return nil
}

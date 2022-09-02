// Package instrumentation contains backend plugin instrumentation logic.
package instrumentation

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	pluginRequestCounter = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_request_total",
		Help:      "The total amount of plugin requests",
	}, []string{"plugin_id", "endpoint", "status"})

	pluginRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_request_duration_milliseconds",
		Help:      "Plugin request duration",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
	}, []string{"plugin_id", "endpoint"})
)

// instrumentPluginRequest instruments success rate and latency of `fn`
func instrumentPluginRequest(pluginCtx *backend.PluginContext, endpoint string, fn func() error) error {
	status := "ok"

	start := time.Now()

	err := fn()
	if err != nil {
		status = "error"
	}

	elapsed := time.Since(start) / time.Millisecond
	pluginRequestDuration.WithLabelValues(pluginCtx.PluginID, endpoint).Observe(float64(elapsed))
	pluginRequestCounter.WithLabelValues(pluginCtx.PluginID, endpoint, status).Inc()

	return err
}

// InstrumentCollectMetrics instruments collectMetrics.
func InstrumentCollectMetrics(req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(req, "collectMetrics", fn)
}

// InstrumentCheckHealthRequest instruments checkHealth.
func InstrumentCheckHealthRequest(req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(req, "checkHealth", fn)
}

// InstrumentCallResourceRequest instruments callResource.
func InstrumentCallResourceRequest(req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(req, "callResource", fn)
}

// InstrumentQueryDataRequest instruments success rate and latency of query data requests.
func InstrumentQueryDataRequest(req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(req, "queryData", fn)
}

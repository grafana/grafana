package backendplugin

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	pluginRequestCounter *prometheus.CounterVec
	pluginRequestLatency *prometheus.SummaryVec
)

func init() {
	pluginRequestCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "plugin_request_total",
		Help: "The total amount of plugin requests",
	}, []string{"plugin_id", "endpoint", "status"})

	pluginRequestLatency = prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Name:       "plugin_request_latency_milliseconds",
		Help:       "Plugin request latency",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"plugin_id", "endpoint"})

	prometheus.MustRegister(pluginRequestCounter, pluginRequestLatency)
}

// InstrumentPluginRequest instruments success rate and latency of `fn`
func InstrumentPluginRequest(pluginID string, endpoint string, fn func() error) error {
	status := "ok"

	start := time.Now()

	err := fn()
	if err != nil && err != ErrStreamDrained {
		status = "error"
	}

	elapsed := time.Since(start) / time.Millisecond
	pluginRequestLatency.WithLabelValues(pluginID, endpoint).Observe(float64(elapsed))
	pluginRequestCounter.WithLabelValues(pluginID, endpoint, status).Inc()

	return err
}

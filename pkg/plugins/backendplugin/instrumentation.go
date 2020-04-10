package backendplugin

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	pluginRequestCounter  *prometheus.CounterVec
	pluginRequestDuration *prometheus.SummaryVec
)

func init() {
	pluginRequestCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_request_total",
		Help:      "The total amount of plugin requests",
	}, []string{"plugin_id", "endpoint", "status"})

	pluginRequestDuration = prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Namespace:  "grafana",
		Name:       "plugin_request_duration_milliseconds",
		Help:       "Plugin request duration",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"plugin_id", "endpoint"})

	prometheus.MustRegister(pluginRequestCounter, pluginRequestDuration)
}

// InstrumentPluginRequest instruments success rate and latency of `fn`
func InstrumentPluginRequest(pluginID string, endpoint string, fn func() error) error {
	status := "ok"

	start := time.Now()

	err := fn()
	if err != nil {
		status = "error"
	}

	elapsed := time.Since(start) / time.Millisecond
	pluginRequestDuration.WithLabelValues(pluginID, endpoint).Observe(float64(elapsed))
	pluginRequestCounter.WithLabelValues(pluginID, endpoint, status).Inc()

	return err
}

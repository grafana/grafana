package backendplugin

import "github.com/prometheus/client_golang/prometheus"

var (
	pluginRequestCounter *prometheus.CounterVec
	pluginRequestLatency *prometheus.SummaryVec
)

func init() {
	pluginRequestCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "plugin_request_total",
		Help: "The total amount of plugin requests",
	}, []string{"name", "endpoint", "status"})

	pluginRequestLatency = prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Name:       "plugin_request_latency",
		Help:       "Plugin request latency",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"name", "endpoint"})

	prometheus.MustRegister(pluginRequestCounter, pluginRequestLatency)
}

// InstrumentPluginRequest instruments success rate and latency of `fn`
func InstrumentPluginRequest(pluginType string, endpoint string, fn func() error) error {
	status := "ok"

	t := prometheus.NewTimer(pluginRequestLatency.WithLabelValues(pluginType, endpoint))

	err := fn()
	if err != nil {
		status = "error"
	}

	pluginRequestCounter.WithLabelValues(pluginType, endpoint, status).Inc()
	t.ObserveDuration()

	return err
}

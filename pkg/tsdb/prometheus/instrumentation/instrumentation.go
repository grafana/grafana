package instrumentation

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	namespace = "grafana"
	subsystem = "prometheus"
)

var prometheusRequestDurationHistogram = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Namespace: namespace,
	Subsystem: subsystem,
	Name:      "request_duration_milliseconds",
	Help:      "Time in milliseconds spend to respond a request",
	Buckets:   []float64{10, 50, 100, 500, 1000, 2500, 5000},
}, []string{"pluginId", "endpoint", "status"})

func InstrumentRequestDurationMilliseconds(pluginId, endpoint, status string, milliseconds int64) {
	prometheusRequestDurationHistogram.WithLabelValues(pluginId, endpoint, status).Observe(float64(milliseconds))
}

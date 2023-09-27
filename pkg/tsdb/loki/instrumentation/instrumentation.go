package instrumentation

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	pluginResponseParsingDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "loki_plugin_response_parse_duration_seconds",
		Help:      "Duration of Loki parsing the response in seconds",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25},
	}, []string{"status", "endpoint"})
)

const (
	EndpointQueryData = "queryData"
)

func UpdatePluginResponseParsingDurationSeconds(duration time.Duration, status string) {
	pluginResponseParsingDurationSeconds.WithLabelValues(status, EndpointQueryData).Observe(duration.Seconds())
}

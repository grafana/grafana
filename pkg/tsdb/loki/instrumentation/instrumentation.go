package instrumentation

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	pluginParsingResponseDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "loki_plugin_parse_response_duration_seconds",
		Help:      "Duration of Loki parsing the response in seconds",
		Buckets:   []float64{.001, 0.0025, .005, .0075, .01, .02, .03, .04, .05, .075, .1, .25, .5, 1, 5, 10, 25},
	}, []string{"status", "endpoint"})
)

func UpdatePluginParsingResponseDurationSeconds(ctx context.Context, duration time.Duration, status string) {
	histogram := pluginParsingResponseDurationSeconds.WithLabelValues(status, string(backend.EndpointQueryData))

	if traceID := tracing.TraceIDFromContext(ctx, true); traceID != "" {
		histogram.(prometheus.ExemplarObserver).ObserveWithExemplar(duration.Seconds(), prometheus.Labels{"traceID": traceID})
	} else {
		histogram.Observe(duration.Seconds())
	}
}

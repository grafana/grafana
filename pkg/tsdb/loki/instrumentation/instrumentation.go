package instrumentation

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/tracing"
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

	pluginRequestCounter = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "loki_plugin_request_count",
		Help:      "The total amount of loki data source requests",
	}, []string{"status", "endpoint", "status_source", "from_alert", "is_cloud"})
)

const (
	EndpointQueryData = "queryData"
)

func UpdatePluginParsingResponseDurationSeconds(ctx context.Context, duration time.Duration, status string) {
	histogram := pluginParsingResponseDurationSeconds.WithLabelValues(status, EndpointQueryData)

	if traceID := tracing.TraceIDFromContext(ctx, true); traceID != "" {
		histogram.(prometheus.ExemplarObserver).ObserveWithExemplar(duration.Seconds(), prometheus.Labels{"traceID": traceID})
	} else {
		histogram.Observe(duration.Seconds())
	}
}

func UpdateQueryDataMetrics(err error, errorSource string, dsUrl string, fromAlert bool) {
	status := "ok"
	if err != nil {
		status = "error"
		if errors.Is(err, context.Canceled) {
			status = "cancelled"
		}
	}

	fromAlertLabel := "false"
	if fromAlert {
		fromAlertLabel = "true"
	}

	isCloudLabel := "false"
	if strings.Contains(dsUrl, ".grafana.net") {
		isCloudLabel = "true"
	}

	pluginRequestCounter.WithLabelValues(status, EndpointQueryData, errorSource, fromAlertLabel, isCloudLabel).Inc()
}

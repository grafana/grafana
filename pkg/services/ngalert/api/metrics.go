package api

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"gopkg.in/macaron.v1"
)

const (
	GrafanaBackend = "grafana"
	ProxyBackend   = "proxy"
)

type Metrics struct {
	alerts              *prometheus.GaugeVec
	alertsInvalid       prometheus.Counter
	alertsReceived      prometheus.Counter
	notificationLatency prometheus.Histogram
	notifications       *prometheus.CounterVec
	notificationsFailed *prometheus.CounterVec
	requestDuration     *prometheus.HistogramVec
	silences            *prometheus.GaugeVec
}

func NewMetrics(r prometheus.Registerer) *Metrics {
	return &Metrics{
		alerts: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "alerts",
			Help:      "How many alerts by state.",
		}, []string{"state"}),
		alertsInvalid: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "alerts_invalid_total",
			Help:      "The total number of invalid received alerts.",
		}),
		alertsReceived: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "alerts_received_total",
			Help:      "The total number of received alerts.",
		}),
		notificationLatency: promauto.With(r).NewHistogram(prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "notification_latency_seconds",
			Help:      "Histogram of notification deliveries",
			Buckets:   prometheus.DefBuckets,
		}),
		notifications: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "notifications_total",
			Help:      "The total number of attempted notfications by integration.",
		}, []string{"integration"}),
		notificationsFailed: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "notifications_failed_total",
			Help:      "The total number of failed notfications by integration.",
		}, []string{"integration"}),
		requestDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "grafana",
				Subsystem: "alerting",
				Name:      "request_duration_seconds",
				Help:      "Histogram of requests to the Alerting API",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"method", "route", "status_code", "backend"},
		),
		silences: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: "grafana",
			Subsystem: "alerting",
			Name:      "silences",
			Help:      "The total number of silences by state.",
		}, []string{"state"}),
	}
}

// Instrument wraps a middleware, instrumenting the request latencies.
func Instrument(
	method,
	path string,
	action interface{},
	metrics *Metrics,
) macaron.Handler {
	normalizedPath := MakeLabelValue(path)

	return func(c *models.ReqContext) {
		start := time.Now()
		var res response.Response
		val, err := c.Invoke(action)
		if err == nil && val != nil && len(val) > 0 {
			res = val[0].Interface().(response.Response)
		} else {
			res = routing.ServerError(err)
		}

		// TODO: We could look up the datasource type via our datasource service
		var backend string
		recipient := c.Params("Recipient")
		if recipient == apimodels.GrafanaBackend.String() || recipient == "" {
			backend = GrafanaBackend
		} else {
			backend = ProxyBackend
		}

		ls := prometheus.Labels{
			"method":      method,
			"route":       normalizedPath,
			"status_code": fmt.Sprint(res.Status()),
			"backend":     backend,
		}
		res.WriteTo(c)
		metrics.requestDuration.With(ls).Observe(time.Since(start).Seconds())
	}
}

var invalidChars = regexp.MustCompile(`[^a-zA-Z0-9]+`)

// MakeLabelValue normalizes a path template
func MakeLabelValue(path string) string {
	// Convert non-alnums to underscores.
	result := invalidChars.ReplaceAllString(path, "_")

	// Trim leading and trailing underscores.
	result = strings.Trim(result, "_")

	// Make it all lowercase
	result = strings.ToLower(result)

	// Special case.
	if result == "" {
		result = "root"
	}
	return result
}

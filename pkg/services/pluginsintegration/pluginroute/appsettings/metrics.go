package appsettings

import (
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	appSubresourceRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "app_apiserver",
			Name:      "subresource_requests_total",
			Help:      "Total app subresource requests by endpoint, plugin, and outcome.",
		},
		[]string{"endpoint", "plugin_id", "status"},
	)

	appSubresourceRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "app_apiserver",
			Name:      "subresource_request_duration_seconds",
			Help:      "Duration of app subresource requests by endpoint and plugin.",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"endpoint", "plugin_id"},
	)
)

func registerSubresourceMetrics(reg prometheus.Registerer) {
	if reg == nil {
		return
	}
	for _, collector := range []prometheus.Collector{appSubresourceRequests, appSubresourceRequestDuration} {
		if err := reg.Register(collector); err != nil {
			if _, ok := errors.AsType[prometheus.AlreadyRegisteredError](err); !ok {
				panic(err)
			}
		}
	}
}

// subresourceMetric tracks a single subresource request; defer Record in the handler.
type subresourceMetric struct {
	endpoint string
	pluginID string
	start    time.Time
	status   string
}

func newSubresourceMetric(endpoint, pluginID string) *subresourceMetric {
	return &subresourceMetric{
		endpoint: endpoint,
		pluginID: pluginID,
		start:    time.Now(),
		status:   "success",
	}
}

func (m *subresourceMetric) SetError() { m.status = "error" }

// Record emits the counter and duration histogram once per request.
func (m *subresourceMetric) Record() {
	appSubresourceRequests.WithLabelValues(m.endpoint, m.pluginID, m.status).Inc()
	appSubresourceRequestDuration.WithLabelValues(m.endpoint, m.pluginID).Observe(time.Since(m.start).Seconds())
}

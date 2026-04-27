package appplugin

import (
	"sync"
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

	registerSubresourceMetricsOnce sync.Once
)

func registerSubresourceMetrics(reg prometheus.Registerer) {
	registerSubresourceMetricsOnce.Do(func() {
		reg.MustRegister(appSubresourceRequests, appSubresourceRequestDuration)
	})
}

// connectMetric tracks a single request across the Connect (setup) and
// handler (serve) phases.  Call Record() explicitly after Connect errors,
// or use defer m.Record() inside the handler.
type connectMetric struct {
	endpoint string
	pluginID string
	start    time.Time
	status   string
}

func newConnectMetric(endpoint, pluginID string) *connectMetric {
	return &connectMetric{
		endpoint: endpoint,
		pluginID: pluginID,
		start:    time.Now(),
		status:   "success",
	}
}

func (m *connectMetric) SetError()    { m.status = "error" }
func (m *connectMetric) SetNotFound() { m.status = "not_found" }

// Record emits the counter and duration histogram once per request.
func (m *connectMetric) Record() {
	appSubresourceRequests.WithLabelValues(m.endpoint, m.pluginID, m.status).Inc()
	appSubresourceRequestDuration.WithLabelValues(m.endpoint, m.pluginID).Observe(time.Since(m.start).Seconds())
}

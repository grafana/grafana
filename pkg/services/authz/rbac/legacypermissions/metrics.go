package legacypermissions

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type serverMetrics struct {
	duration *prometheus.HistogramVec
}

func newMetrics(reg prometheus.Registerer, implementation string) *serverMetrics {
	duration := promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:        "grafana_authz_legacy_get_user_permissions_duration_seconds",
		Help:        "Time spent handling LegacyGetUserPermissions requests, including response streaming.",
		Buckets:     prometheus.ExponentialBuckets(0.00001, 4, 10),
		ConstLabels: prometheus.Labels{"implementation": implementation},
	}, []string{"status"})
	duration.WithLabelValues("ok")
	duration.WithLabelValues("error")
	return &serverMetrics{duration: duration}
}

func (m *serverMetrics) observe(started time.Time, status string) {
	if m != nil {
		m.duration.WithLabelValues(status).Observe(time.Since(started).Seconds())
	}
}

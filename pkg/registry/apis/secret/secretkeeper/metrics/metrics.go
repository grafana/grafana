package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana_secrets_manager"
	subsystem = "keeper"
)

// KeeperMetrics is a struct that contains all the metrics for an implementation of all keepers.
type KeeperMetrics struct {
	StoreDuration  *prometheus.HistogramVec
	UpdateDuration *prometheus.HistogramVec
	ExposeDuration *prometheus.HistogramVec
	DeleteDuration *prometheus.HistogramVec
}

func newKeeperMetrics() *KeeperMetrics {
	return &KeeperMetrics{
		StoreDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "store_duration_seconds",
			Help:      "Duration of keeper store operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		UpdateDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "update_duration_seconds",
			Help:      "Duration of keeper update operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		ExposeDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "expose_duration_seconds",
			Help:      "Duration of keeper expose operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
		DeleteDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "delete_duration_seconds",
			Help:      "Duration of keeper delete operations",
			Buckets:   prometheus.DefBuckets,
		}, []string{"keeper_type"}),
	}
}

// NewKeeperMetrics creates a new KeeperMetrics struct containing registered metrics
func NewKeeperMetrics(reg prometheus.Registerer) *KeeperMetrics {
	m := newKeeperMetrics()

	if reg != nil {
		reg.MustRegister(
			m.StoreDuration,
			m.UpdateDuration,
			m.ExposeDuration,
			m.DeleteDuration,
		)
	}

	return m
}

func NewTestMetrics() *KeeperMetrics {
	return newKeeperMetrics()
}

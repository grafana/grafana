package search

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type bleveIndexMetrics struct {
	indexTenants *prometheus.CounterVec
	indexSize    prometheus.Gauge
}

func newBleveIndexMetrics(reg prometheus.Registerer) *bleveIndexMetrics {
	return &bleveIndexMetrics{
		indexSize: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Namespace: "index_server",
			Name:      "index_size",
			Help:      "Size of the index in bytes - only for file-based indices",
		}),
		indexTenants: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Namespace: "index_server",
			Name:      "index_tenants",
			Help:      "Number of tenants in the index",
		}, []string{"index_storage"}), // index_storage is either "file" or "memory"
	}
}

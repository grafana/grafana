package manager

import (
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	OpEncrypt = "encrypt"
	OpDecrypt = "decrypt"
)

var (
	opsCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: metrics.ExporterName,
			Name:      "encryption_ops_total",
			Help:      "A counter for encryption operations",
		},
		[]string{"success", "operation"},
	)
	cacheReadsCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: metrics.ExporterName,
			Name:      "encryption_cache_reads_total",
			Help:      "A counter for encryption cache reads",
		},
		[]string{"hit", "method"},
	)
)

func init() {
	prometheus.MustRegister(
		opsCounter,
		cacheReadsCounter,
	)
}

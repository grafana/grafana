package manager

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
)

const (
	OpEncrypt = "encrypt"
	OpDecrypt = "decrypt"
)

var (
	opsCounter = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Namespace: metrics.ExporterName,
			Name:      "encryption_ops_total",
			Help:      "A counter for encryption operations",
		},
		[]string{"success", "operation"},
		map[string][]string{
			"success":   {"true", "false"},
			"operation": {OpEncrypt, OpDecrypt},
		},
	)
	cacheReadsCounter = metricutil.NewCounterVecStartingAtZero(
		prometheus.CounterOpts{
			Namespace: metrics.ExporterName,
			Name:      "encryption_cache_reads_total",
			Help:      "A counter for encryption cache reads",
		},
		[]string{"hit", "method"},
		map[string][]string{
			"hit":    {"true", "false"},
			"method": {"byId", "byName"},
		},
	)
)

func init() {
	prometheus.MustRegister(
		opsCounter,
		cacheReadsCounter,
	)
}

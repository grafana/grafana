package dualwrite

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Metrics struct {
	ModeMismatchCounter *prometheus.CounterVec
}

func ProvideMetrics(reg prometheus.Registerer) *Metrics {
	return &Metrics{
		ModeMismatchCounter: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "dualwriter_mode_mismatch_total",
			Help: "Number of times the MigrationStatusReader mode disagrees with the current dual writer mode at startup.",
		}, []string{"resource", "current_mode", "new_mode"}),
	}
}

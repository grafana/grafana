package dualwrite

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type dualWriterMetrics struct {
	backgroundErrors *prometheus.CounterVec
}

func provideDualWriterMetrics(reg prometheus.Registerer) *dualWriterMetrics {
	return &dualWriterMetrics{
		backgroundErrors: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "dualwriter_background_errors_total",
			Help: "Total number of failed background operations in unified storage",
		}, []string{"resource", "method"}),
	}
}

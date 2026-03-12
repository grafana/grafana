package dualwrite

import (
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	registerMetricsOnce    sync.Once
	backgroundErrorsMetric = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "dualwriter_background_errors_total",
		Help: "Total number of failed background operations in unified storage",
	}, []string{"resource", "method"})
)

type dualWriterMetrics struct {
	backgroundErrors *prometheus.CounterVec
}

func provideDualWriterMetrics(reg prometheus.Registerer) *dualWriterMetrics {
	registerMetricsOnce.Do(func() {
		if reg != nil {
			if err := reg.Register(backgroundErrorsMetric); err != nil {
				log.New("dualwrite").Warn("failed to register dualwriter metrics", "error", err)
			}
		}
	})
	return &dualWriterMetrics{
		backgroundErrors: backgroundErrorsMetric,
	}
}

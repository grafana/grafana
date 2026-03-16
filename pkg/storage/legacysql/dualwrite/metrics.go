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

	backgroundErrorMethods = []string{"GET", "LIST", "CREATE", "DELETE", "UPDATE", "DELETE_COLLECTION"}
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

// initResource initializes all method counter combinations to zero for the given resource,
// so that the metric is distinguishable from "not scraped" (absent) vs "no errors" (zero).
func (m *dualWriterMetrics) initResource(resource string) {
	for _, method := range backgroundErrorMethods {
		m.backgroundErrors.WithLabelValues(resource, method).Add(0)
	}
}

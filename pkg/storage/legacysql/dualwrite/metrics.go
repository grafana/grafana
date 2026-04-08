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

	statusReaderNullMetric = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "dualwriter_status_reader_null_total",
		Help: "Total number of times the status reader was null when resolving storage mode",
	}, []string{"resource"})

	statusReaderErrorsMetric = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "dualwriter_status_reader_errors_total",
		Help: "Total number of errors from the status reader when resolving storage mode",
	}, []string{"resource"})

	backgroundErrorMethods = []string{"GET", "LIST", "CREATE", "DELETE", "UPDATE", "DELETE_COLLECTION"}
)

type dualWriterMetrics struct {
	backgroundErrors   *prometheus.CounterVec
	statusReaderNull   *prometheus.CounterVec
	statusReaderErrors *prometheus.CounterVec
}

func provideDualWriterMetrics(reg prometheus.Registerer) *dualWriterMetrics {
	registerMetricsOnce.Do(func() {
		if reg != nil {
			for _, m := range []prometheus.Collector{backgroundErrorsMetric, statusReaderNullMetric, statusReaderErrorsMetric} {
				if err := reg.Register(m); err != nil {
					log.New("dualwrite").Warn("failed to register dualwriter metrics", "error", err)
				}
			}
		}
	})
	return &dualWriterMetrics{
		backgroundErrors:   backgroundErrorsMetric,
		statusReaderNull:   statusReaderNullMetric,
		statusReaderErrors: statusReaderErrorsMetric,
	}
}

// initResource initializes all counter combinations to zero for the given resource,
// so that the metric is distinguishable from "not scraped" (absent) vs "no errors" (zero).
func (m *dualWriterMetrics) initResource(resource string) {
	for _, method := range backgroundErrorMethods {
		m.backgroundErrors.WithLabelValues(resource, method).Add(0)
	}
	m.statusReaderNull.WithLabelValues(resource).Add(0)
	m.statusReaderErrors.WithLabelValues(resource).Add(0)
}

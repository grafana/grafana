package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/weaveworks/common/instrument"
)

type Historian struct {
	WriteDuration *instrument.HistogramCollector
}

func NewHistorianMetrics(r prometheus.Registerer) *Historian {
	return &Historian{
		WriteDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "state_history_request_duration_seconds",
			Help:      "Histogram of request durations to the state history store.",
			Buckets:   instrument.DefBuckets,
		}, instrument.HistogramCollectorBuckets)),
	}
}

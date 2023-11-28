package folderimpl

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "folders"
)

func newFoldersMetrics(r prometheus.Registerer) *foldersMetrics {
	m := &foldersMetrics{
		sharedWithMeFetchFoldersSuccessRequestsDuration: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:      "sharedwithme_fetch_folders_successes_duration_seconds",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			}),
		sharedWithMeFetchFoldersFailureRequestsDuration: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:      "sharedwithme_fetch_folders_failures_duration_seconds",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			}),
	}

	if r != nil {
		r.MustRegister(m.sharedWithMeFetchFoldersSuccessRequestsDuration)
		r.MustRegister(m.sharedWithMeFetchFoldersFailureRequestsDuration)
	}

	return m
}

type foldersMetrics struct {
	sharedWithMeFetchFoldersSuccessRequestsDuration prometheus.Histogram
	sharedWithMeFetchFoldersFailureRequestsDuration prometheus.Histogram
}

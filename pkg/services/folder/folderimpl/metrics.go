package folderimpl

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "folders"
)

type foldersMetrics struct {
	sharedWithMeFetchFoldersRequestsDuration *prometheus.HistogramVec
	foldersGetChildrenRequestsDuration       *prometheus.HistogramVec
}

func newFoldersMetrics(r prometheus.Registerer) *foldersMetrics {
	return &foldersMetrics{
		sharedWithMeFetchFoldersRequestsDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "sharedwithme_fetch_folders_duration_seconds",
				Help:      "Duration of fetching folders with permissions directly assigned to user",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"status"},
		),
		foldersGetChildrenRequestsDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Name:      "get_children_duration_seconds",
				Help:      "Duration of listing subfolders in specific folder",
				Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
			},
			[]string{"parent"},
		),
	}
}

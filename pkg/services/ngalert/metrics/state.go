package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type State struct {
	AlertState          *prometheus.GaugeVec
	StateUpdateDuration prometheus.Histogram
}

func NewStateMetrics(r prometheus.Registerer) *State {
	return &State{
		AlertState: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "alerts",
			Help:      "How many alerts by state.",
		}, []string{"state"}),
		StateUpdateDuration: promauto.With(r).NewHistogram(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "state_calculation_duration_seconds",
				Help:      "The duration of calculation of a single state.",
				Buckets:   []float64{0.01, 0.1, 1, 2, 5, 10},
			},
		),
	}
}

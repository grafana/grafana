package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type State struct {
	StateUpdateDuration prometheus.Histogram
	r                   prometheus.Registerer
}

// Registerer exposes the Prometheus register directly. The state package needs this as, it uses a collector to fetch the current alerts by state in the system.
func (s State) Registerer() prometheus.Registerer {
	return s.r
}

func NewStateMetrics(r prometheus.Registerer) *State {
	return &State{
		r: r,
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

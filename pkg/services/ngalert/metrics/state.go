package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type State struct {
	StateUpdateDuration   prometheus.Histogram
	StateFullSyncDuration prometheus.Histogram
	SendDuration          *prometheus.HistogramVec
	r                     prometheus.Registerer
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
		StateFullSyncDuration: promauto.With(r).NewHistogram(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "state_full_sync_duration_seconds",
				Help:      "The duration of fully synchronizing the state with the database.",
				Buckets:   []float64{0.01, 0.1, 1, 2, 5, 10, 60},
			},
		),
		SendDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "rule_send_alerts_duration_seconds",
				Help:      "The time to send the alerts to Alertmanager.",
				Buckets:   []float64{.01, .1, .5, 1, 5, 10, 15, 30, 60, 120, 180, 240, 300},
			},
			[]string{"org"},
		),
	}
}

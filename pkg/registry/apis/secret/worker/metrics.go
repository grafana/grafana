package worker

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana_secrets_manager"
	subsystem = "outbox_worker"
)

// OutboxMetrics is a struct that contains all the metrics for an implementation of the secrets service.
type OutboxMetrics struct {
	OutboxMessageProcessingDuration *prometheus.HistogramVec
}

func newOutboxMetrics() *OutboxMetrics {
	return &OutboxMetrics{
		OutboxMessageProcessingDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "message_processing_duration_seconds",
			Help:      "Duration of outbox message processing",
			Buckets:   prometheus.DefBuckets,
		}, []string{"message_type", "keeper_type"}),
	}
}

// NewOutboxMetrics creates a new SecretsMetrics struct containing registered metrics
func NewOutboxMetrics(reg prometheus.Registerer) *OutboxMetrics {
	m := newOutboxMetrics()

	if reg != nil {
		reg.MustRegister(
			m.OutboxMessageProcessingDuration,
		)
	}

	return m
}

func NewTestMetrics() *OutboxMetrics {
	return newOutboxMetrics()
}

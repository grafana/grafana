package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana"
	subsystem = "secrets_manager"
)

// SecretsMetrics is a struct that contains all the metrics for an implementation of the secrets service.
type SecretsMetrics struct {
	OutboxMessageProcessingDuration *prometheus.HistogramVec
}

func newSecretsMetrics() *SecretsMetrics {
	return &SecretsMetrics{
		OutboxMessageProcessingDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: subsystem,
			Name:      "outbox_message_processing_duration_seconds",
			Help:      "Duration of outbox message processing",
			Buckets:   prometheus.DefBuckets,
		}, []string{"message_type", "keeper_type"}),
	}
}

// NewSecretsMetrics creates a new SecretsMetrics struct containing registered metrics
func NewSecretsMetrics(reg prometheus.Registerer) *SecretsMetrics {
	m := newSecretsMetrics()

	if reg != nil {
		reg.MustRegister(
			m.OutboxMessageProcessingDuration,
		)
	}

	return m
}

func NewTestMetrics() *SecretsMetrics {
	return newSecretsMetrics()
}

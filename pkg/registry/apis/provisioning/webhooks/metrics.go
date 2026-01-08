package webhooks

import (
	"github.com/prometheus/client_golang/prometheus"
)

type webhookMetrics struct {
	registry        prometheus.Registerer
	eventsProcessed *prometheus.CounterVec
}

func registerWebhookMetrics(registry prometheus.Registerer) webhookMetrics {
	eventsProcessed := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_webhook_events_processed_total",
			Help: "Total number of webhook events processed and what job type was queued",
		},
		[]string{"job"},
	)
	registry.MustRegister(eventsProcessed)

	return webhookMetrics{
		registry:        registry,
		eventsProcessed: eventsProcessed,
	}
}

func (m *webhookMetrics) recordEventProcessed(jobQueued string) {
	m.eventsProcessed.WithLabelValues(jobQueued).Inc()
}

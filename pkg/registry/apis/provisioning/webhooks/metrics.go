package webhooks

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

type webhookMetrics struct {
	registry        prometheus.Registerer
	eventsProcessed *prometheus.CounterVec
}

var (
	once    sync.Once
	metrics webhookMetrics
)

func registerWebhookMetrics(registry prometheus.Registerer) webhookMetrics {
	once.Do(func() {
		eventsProcessed := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_webhook_events_processed_total",
				Help: "Total number of webhook events processed and what job type was queued",
			},
			[]string{"job"},
		)
		registry.MustRegister(eventsProcessed)

		metrics = webhookMetrics{
			registry:        registry,
			eventsProcessed: eventsProcessed,
		}
	})
	return metrics
}

func (m *webhookMetrics) recordEventProcessed(jobQueued string) {
	m.eventsProcessed.WithLabelValues(jobQueued).Inc()
}

package controller

import (
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
	"github.com/prometheus/client_golang/prometheus"
)

type finalizerMetrics struct {
	registry                prometheus.Registerer
	finalizerProcessedTotal *prometheus.CounterVec
	finalizerDuration       *prometheus.HistogramVec
}

func registerFinalizerMetrics(registry prometheus.Registerer) finalizerMetrics {
	finalizerProcessedTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_finalizers_processed_total",
			Help: "Total number of finalizers processed",
		},
		[]string{"finalizer_type", "outcome"},
	)
	registry.MustRegister(finalizerProcessedTotal)

	finalizerDuration := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_finalizers_duration_seconds",
			Help:    "Duration of processing the finalizers",
			Buckets: []float64{0.5, 1.0, 2.0, 5.0, 10.0, 30.0},
		},
		[]string{"finalizer_type", "resource_count_bucket"},
	)
	registry.MustRegister(finalizerDuration)

	return finalizerMetrics{
		registry:                registry,
		finalizerProcessedTotal: finalizerProcessedTotal,
		finalizerDuration:       finalizerDuration,
	}
}

func (m *finalizerMetrics) RecordFinalizer(finalizerType string, outcome string, resourceCountChanged int, duration float64) {
	m.finalizerProcessedTotal.WithLabelValues(finalizerType, outcome).Inc()
	if outcome == utils.SuccessOutcome {
		m.finalizerDuration.WithLabelValues(finalizerType, utils.GetResourceCountBucket(resourceCountChanged)).Observe(duration)
	}
}

type healthMetrics struct {
	registry              prometheus.Registerer
	healthCheckedTotal    *prometheus.CounterVec
	healthCheckedDuration *prometheus.HistogramVec
}

func registerHealthMetrics(registry prometheus.Registerer) healthMetrics {
	healthCheckedTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_health_checked_total",
			Help: "Total number of health checks performed",
		},
		[]string{"outcome"},
	)
	registry.MustRegister(healthCheckedTotal)

	healthCheckedDuration := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grafana_provisioning_health_checked_duration_seconds",
			Help:    "Duration of health checks",
			Buckets: []float64{0.1, 0.2, 0.5, 1.0, 2.0, 5.0},
		},
		[]string{},
	)
	registry.MustRegister(healthCheckedDuration)

	return healthMetrics{
		registry:              registry,
		healthCheckedTotal:    healthCheckedTotal,
		healthCheckedDuration: healthCheckedDuration,
	}
}

func (m *healthMetrics) RecordHealthCheck(outcome string, duration float64) {
	m.healthCheckedTotal.WithLabelValues(outcome).Inc()
	m.healthCheckedDuration.WithLabelValues().Observe(duration)
}

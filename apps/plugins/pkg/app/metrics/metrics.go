package metrics

import (
	"errors"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "plugins_app"
)

var (
	// API request metrics
	APIRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "api_requests_total",
			Help:      "Total number of API requests",
		},
		[]string{"operation", "status"},
	)

	// Reconciliation metrics
	ChildReconciliationTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "child_reconciliation_total",
			Help:      "Total number of child plugin reconciliation operations",
		},
		[]string{"status"},
	)

	ChildReconciliationDurationSeconds = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "child_reconciliation_duration_seconds",
			Help:      "Duration of child plugin reconciliation operations in seconds",
			Buckets:   prometheus.DefBuckets,
		},
	)

	// Registration metrics
	RegistrationOperationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "registration_operations_total",
			Help:      "Total number of registration operations",
		},
		[]string{"operation", "status"},
	)

	RegistrationDurationSeconds = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "registration_duration_seconds",
			Help:      "Duration of registration operations in seconds",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"operation"},
	)
)

func MustRegister(registerer prometheus.Registerer) {
	metricsToRegister := []prometheus.Collector{
		APIRequestsTotal,
		ChildReconciliationTotal,
		ChildReconciliationDurationSeconds,
		RegistrationOperationsTotal,
		RegistrationDurationSeconds,
	}

	for _, metric := range metricsToRegister {
		if err := registerer.Register(metric); err != nil {
			var alreadyRegistered prometheus.AlreadyRegisteredError
			if errors.As(err, &alreadyRegistered) {
				continue
			}
			panic(err)
		}
	}
}

package metrics

import (
	"errors"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "advisor_app"
)

var (
	// CheckProcessingTotal counts check processing outcomes by operation, status, and check_type.
	CheckProcessingTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "check_processing_total",
			Help:      "Total number of check processing operations by operation, status, and check type",
		},
		[]string{"operation", "status", "check_type"},
	)

	// CheckProcessingDurationSeconds is the duration of check processing operations.
	CheckProcessingDurationSeconds = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "check_processing_duration_seconds",
			Help:      "Duration of check processing operations in seconds",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{"operation", "check_type"},
	)

	// CheckRegistrationTotal counts register check types endpoint outcomes.
	CheckRegistrationTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "check_registration_total",
			Help:      "Total number of check type registration operations",
		},
		[]string{"status"},
	)

	// OrgIDErrorsTotal counts errors resolving org ID from namespace.
	OrgIDErrorsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "org_id_errors_total",
			Help:      "Total number of errors resolving org ID from namespace",
		},
	)

	// StepPanicsTotal counts panics recovered in step execution.
	StepPanicsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "step_panics_total",
			Help:      "Total number of panics recovered in check step execution",
		},
		[]string{"step_id"},
	)
)

// MustRegister registers all metrics with the given registerer. No-op if registerer is nil.
func MustRegister(registerer prometheus.Registerer) {
	if registerer == nil {
		return
	}
	metricsToRegister := []prometheus.Collector{
		CheckProcessingTotal,
		CheckProcessingDurationSeconds,
		CheckRegistrationTotal,
		OrgIDErrorsTotal,
		StepPanicsTotal,
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

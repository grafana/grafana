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

	// MTSchedulerDiscoveriesTotal counts cluster-wide namespace discovery attempts by the MT scheduler.
	MTSchedulerDiscoveriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "mt_scheduler_discoveries_total",
			Help:      "Total cluster-wide namespace discovery attempts by the MT scheduler",
		},
		[]string{"status"},
	)

	// MTSchedulerDiscoveryDurationSeconds is the duration of MT scheduler namespace discovery.
	MTSchedulerDiscoveryDurationSeconds = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "mt_scheduler_discovery_duration_seconds",
			Help:      "Duration of MT scheduler namespace discovery in seconds",
			Buckets:   prometheus.DefBuckets,
		},
	)

	// MTSchedulerNamespacesDiscovered is the number of namespaces from the most recent successful MT discovery.
	MTSchedulerNamespacesDiscovered = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Namespace: namespace,
			Name:      "mt_scheduler_namespaces_discovered",
			Help:      "Number of namespaces discovered in the most recent successful MT discovery",
		},
	)

	// MTSchedulerNamespaceTicksTotal counts per-namespace tick outcomes in the MT scheduler.
	MTSchedulerNamespaceTicksTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Name:      "mt_scheduler_namespace_ticks_total",
			Help:      "Total per-namespace tick outcomes in the MT scheduler",
		},
		[]string{"result"},
	)

	// MTSchedulerNamespaceTickDurationSeconds is the duration of per-namespace MT scheduler ticks that performed work.
	MTSchedulerNamespaceTickDurationSeconds = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Namespace: namespace,
			Name:      "mt_scheduler_namespace_tick_duration_seconds",
			Help:      "Duration of per-namespace MT scheduler ticks that performed work",
			Buckets:   prometheus.DefBuckets,
		},
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
		MTSchedulerDiscoveriesTotal,
		MTSchedulerDiscoveryDurationSeconds,
		MTSchedulerNamespacesDiscovered,
		MTSchedulerNamespaceTicksTotal,
		MTSchedulerNamespaceTickDurationSeconds,
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

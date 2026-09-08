package controller

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
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

// Cause labels for the reconcile-error metric. A userCause failure is one the
// user must fix (e.g. revoked or insufficient credentials); systemCause covers
// everything else. SLOs should alert on systemCause and exclude userCause.
const (
	reconcileCauseUser   = "user"
	reconcileCauseSystem = "system"
)

// Phase labels for the reconcile-error metric, identifying where in
// reconciliation the failure occurred. Every error exit of process() maps to
// one of these so the counter is a complete reconciliation-error signal, not a
// partial one.
const (
	reconcilePhaseSetup    = "setup"    // parsing the work-queue key
	reconcilePhaseFetch    = "fetch"    // resolving the object from the read seam
	reconcilePhaseIdentity = "identity" // establishing the provisioning identity
	reconcilePhaseDelete   = "delete"   // running delete finalizers
	reconcilePhaseQuota    = "quota"    // resolving/evaluating namespace quota
	reconcilePhaseToken    = "token"    // generating a repository token from a connection
	reconcilePhaseBuild    = "build"    // constructing the repository (incl. secret decryption)
	reconcilePhaseBranch   = "branch"   // resolving the default branch
	reconcilePhaseHealth   = "health"   // running the health check
	reconcilePhaseHook     = "hook"     // running webhooks / secret rotation
	reconcilePhaseStatus   = "status"   // writing the status patch
	reconcilePhaseSync     = "sync"     // enqueuing the sync job
)

type reconcileErrorMetrics struct {
	reconcileErrorsTotal *prometheus.CounterVec
}

func registerReconcileErrorMetrics(registry prometheus.Registerer) *reconcileErrorMetrics {
	reconcileErrorsTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grafana_provisioning_repository_reconcile_errors_total",
			Help: "Total number of repository reconciliation errors by phase and cause. Filter cause!=\"user\" to exclude user-caused failures (e.g. revoked credentials) from SLOs.",
		},
		[]string{"phase", "cause"},
	)
	registry.MustRegister(reconcileErrorsTotal)

	return &reconcileErrorMetrics{reconcileErrorsTotal: reconcileErrorsTotal}
}

func (m *reconcileErrorMetrics) RecordReconcileError(phase, cause string) {
	// Nil receiver keeps partial-construction unit tests (which don't wire
	// metrics) safe; the production controller always registers this recorder.
	if m == nil {
		return
	}
	m.reconcileErrorsTotal.WithLabelValues(phase, cause).Inc()
}

//go:generate mockery --name=HealthMetricsRecorder --structname=MockHealthMetricsRecorder --inpackage --filename metrics_mock.go --with-expecter
type HealthMetricsRecorder interface {
	RecordHealthCheck(resource, outcome string, duration float64)
}

type healthMetrics struct {
	registry              prometheus.Registerer
	healthCheckedTotal    *prometheus.CounterVec
	healthCheckedDuration *prometheus.HistogramVec
}

var (
	once    sync.Once
	metrics HealthMetricsRecorder
)

func NewHealthMetricsRecorder(registry prometheus.Registerer) HealthMetricsRecorder {
	once.Do(func() {
		healthCheckedTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_health_checked_total",
				Help: "Total number of health checks performed",
			},
			[]string{"resource", "outcome"},
		)
		registry.MustRegister(healthCheckedTotal)

		healthCheckedDuration := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_health_checked_duration_seconds",
				Help:    "Duration of health checks",
				Buckets: []float64{0.1, 0.2, 0.5, 1.0, 2.0, 5.0},
			},
			[]string{"resource"},
		)
		registry.MustRegister(healthCheckedDuration)

		metrics = &healthMetrics{
			registry:              registry,
			healthCheckedTotal:    healthCheckedTotal,
			healthCheckedDuration: healthCheckedDuration,
		}
	})
	return metrics
}

func (m *healthMetrics) RecordHealthCheck(resource, outcome string, duration float64) {
	m.healthCheckedTotal.WithLabelValues(resource, outcome).Inc()
	m.healthCheckedDuration.WithLabelValues(resource).Observe(duration)
}

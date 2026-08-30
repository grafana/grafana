package lease

import (
	"errors"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Outcome labels.
const (
	outcomeSuccess     = "success"
	outcomeError       = "error"
	outcomeAlreadyHeld = "already_held"
	outcomeLost        = "lost"
	outcomeExecuted    = "executed"
	outcomeSkipped     = "skipped"

	lossReasonExpired = "expired"
	lossReasonLost    = "lost"
	lossReasonError   = "error"
)

// Metrics holds Prometheus collectors for the lease manager and its
// background garbage collector.
type Metrics struct {
	AcquireDuration    *prometheus.HistogramVec
	AcquireRetries     prometheus.Histogram
	ReleaseDuration    *prometheus.HistogramVec
	RenewalsTotal      prometheus.Counter
	LossesTotal        *prometheus.CounterVec
	GCDurationSeconds  *prometheus.HistogramVec
	GCKeysScannedTotal prometheus.Counter
	GCKeysDeletedTotal prometheus.Counter
}

// NewMetrics creates the lease manager metrics and registers them with reg.
// A nil registerer is accepted and causes the collectors to remain
// unregistered — callers that don't care about exposing metrics (e.g. tests
// exercising unrelated behavior) can pass nil rather than wiring up a
// throwaway registry.
func NewMetrics(reg prometheus.Registerer) *Metrics {
	m := &Metrics{
		AcquireDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "lease_manager_acquire_duration_seconds",
			Help:                            "Time (in seconds) spent in Acquire calls, labeled by outcome.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"outcome"}),
		AcquireRetries: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:    "lease_manager_acquire_retries",
			Help:    "Number of retries performed by Acquire calls that needed at least one retry.",
			Buckets: []float64{1, 2, 3},
		}),
		ReleaseDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "lease_manager_release_duration_seconds",
			Help:                            "Time (in seconds) spent in Release calls, labeled by outcome.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"outcome"}),
		RenewalsTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "lease_manager_renewals_total",
			Help: "Total number of successful auto-renewals.",
		}),
		LossesTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "lease_manager_losses_total",
			Help: "Total number of leases lost involuntarily, labeled by reason (expired, lost, error).",
		}, []string{"reason"}),
		GCDurationSeconds: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "lease_manager_gc_duration_seconds",
			Help:                            "Wall-clock duration (in seconds) of a single garbage collection run, labeled by outcome.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"outcome"}),
		GCKeysScannedTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "lease_manager_gc_keys_scanned_total",
			Help: "Total number of lease keys scanned by garbage collection.",
		}),
		GCKeysDeletedTotal: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "lease_manager_gc_keys_deleted_total",
			Help: "Total number of lease keys deleted by garbage collection.",
		}),
	}

	// Pre-initialise label series so they're always present in scrapes.
	m.AcquireDuration.WithLabelValues(outcomeSuccess)
	m.AcquireDuration.WithLabelValues(outcomeAlreadyHeld)
	m.AcquireDuration.WithLabelValues(outcomeError)
	m.ReleaseDuration.WithLabelValues(outcomeSuccess)
	m.ReleaseDuration.WithLabelValues(outcomeLost)
	m.ReleaseDuration.WithLabelValues(outcomeError)
	m.LossesTotal.WithLabelValues(lossReasonExpired).Add(0)
	m.LossesTotal.WithLabelValues(lossReasonLost).Add(0)
	m.LossesTotal.WithLabelValues(lossReasonError).Add(0)
	m.GCDurationSeconds.WithLabelValues(outcomeExecuted)
	m.GCDurationSeconds.WithLabelValues(outcomeSkipped)
	m.GCDurationSeconds.WithLabelValues(outcomeError)

	return m
}

func (m *Metrics) observeAcquireDuration(d time.Duration, outcome string) {
	m.AcquireDuration.WithLabelValues(outcome).Observe(d.Seconds())
}

func (m *Metrics) observeAcquireRetries(attempts int) {
	if attempts <= 0 {
		return
	}
	m.AcquireRetries.Observe(float64(attempts))
}

func (m *Metrics) observeReleaseDuration(d time.Duration, outcome string) {
	m.ReleaseDuration.WithLabelValues(outcome).Observe(d.Seconds())
}

func (m *Metrics) recordRenewal() {
	m.RenewalsTotal.Inc()
}

func (m *Metrics) recordLoss(reason string) {
	m.LossesTotal.WithLabelValues(reason).Inc()
}

func (m *Metrics) addGCKeysScanned(n int) {
	if n == 0 {
		return
	}
	m.GCKeysScannedTotal.Add(float64(n))
}

func (m *Metrics) addGCKeysDeleted(n int) {
	if n == 0 {
		return
	}
	m.GCKeysDeletedTotal.Add(float64(n))
}

func (m *Metrics) observeGCDuration(d time.Duration, outcome string) {
	m.GCDurationSeconds.WithLabelValues(outcome).Observe(d.Seconds())
}

// acquireOutcome returns the outcome label for an Acquire result.
func acquireOutcome(err error) string {
	switch {
	case err == nil:
		return outcomeSuccess
	case errors.Is(err, ErrLeaseAlreadyHeld):
		return outcomeAlreadyHeld
	default:
		return outcomeError
	}
}

// releaseOutcome returns the outcome label for a Release result.
func releaseOutcome(err error) string {
	switch {
	case err == nil:
		return outcomeSuccess
	case errors.Is(err, ErrLeaseLost):
		return outcomeLost
	default:
		return outcomeError
	}
}

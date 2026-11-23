package federated

import (
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Resource, outcome and reason values are fixed so the labels stay bounded. The resources match
// the names CountError reports.
const (
	legacyAlertRules      = "alertrules"
	legacyRecordingRules  = "recordingrules"
	legacyLibraryElements = "library_elements"

	legacyOutcomeOK       = "ok"
	legacyOutcomeError    = "error"
	legacyOutcomeCanceled = "canceled"

	legacySkipMigrated         = "migrated"
	legacySkipNamespaceDeleted = "namespace_deleted"
)

var (
	legacyResources = []string{legacyAlertRules, legacyRecordingRules, legacyLibraryElements}
	legacyOutcomes  = []string{legacyOutcomeOK, legacyOutcomeError, legacyOutcomeCanceled}
	legacySkips     = []string{legacySkipMigrated, legacySkipNamespaceDeleted}
)

// legacyStatsMetrics measures the legacy database counts. A nil value records nothing.
type legacyStatsMetrics struct {
	duration *prometheus.HistogramVec
	skipped  *prometheus.CounterVec
}

func newLegacyStatsMetrics(reg prometheus.Registerer) *legacyStatsMetrics {
	f := promauto.With(reg)
	m := &legacyStatsMetrics{
		duration: f.NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_folder_counts_legacy_query_duration_seconds",
			Help:                            "Duration of legacy database access for folder counts, by resource and outcome. One observation per COUNT query, so a request spanning many folders records several; failed staleness checks and database lookups are recorded as errors",
			Buckets:                         []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"resource", "outcome"}),
		skipped: f.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_folder_counts_legacy_skipped_total",
			Help: "Legacy database counts that were not run, by resource and reason",
		}, []string{"resource", "reason"}),
	}
	// Created up front so rate() alerts see the first failure.
	for _, resource := range legacyResources {
		for _, outcome := range legacyOutcomes {
			m.duration.WithLabelValues(resource, outcome)
		}
		for _, reason := range legacySkips {
			m.skipped.WithLabelValues(resource, reason).Add(0)
		}
	}
	return m
}

func (m *legacyStatsMetrics) observe(resource string, start time.Time, err error) {
	if m == nil {
		return
	}
	m.duration.WithLabelValues(resource, legacyOutcome(err)).Observe(time.Since(start).Seconds())
}

func legacyOutcome(err error) string {
	switch {
	case err == nil:
		return legacyOutcomeOK
	case errors.Is(err, context.Canceled):
		return legacyOutcomeCanceled
	default:
		return legacyOutcomeError
	}
}

func (m *legacyStatsMetrics) skip(resource, reason string) {
	if m == nil {
		return
	}
	m.skipped.WithLabelValues(resource, reason).Inc()
}

// observeAll records one outcome for every resource, for failures that happen before any of them
// is counted.
func (m *legacyStatsMetrics) observeAll(start time.Time, err error) {
	for _, resource := range legacyResources {
		m.observe(resource, start, err)
	}
}

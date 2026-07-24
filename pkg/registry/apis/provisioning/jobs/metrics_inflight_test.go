package jobs

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

// histSampleCount returns how many observations a HistogramVec recorded for the given
// label values.
func histSampleCount(t *testing.T, h *prometheus.HistogramVec, lvs ...string) uint64 {
	t.Helper()
	obs, err := h.GetMetricWithLabelValues(lvs...)
	require.NoError(t, err)
	var m dto.Metric
	require.NoError(t, obs.(prometheus.Metric).Write(&m))
	return m.GetHistogram().GetSampleCount()
}

func TestJobMetrics_InFlightIncDec(t *testing.T) {
	m := &JobMetrics{
		inFlight: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{Name: "test_jobs_in_flight"},
			[]string{"driver_id", "action"},
		),
	}
	busy := m.inFlight.WithLabelValues("0", "pull")
	require.Equal(t, 0.0, testutil.ToFloat64(busy))

	m.IncInFlight("0", "pull")
	require.Equal(t, 1.0, testutil.ToFloat64(busy))

	m.DecInFlight("0", "pull")
	require.Equal(t, 0.0, testutil.ToFloat64(busy))
}

// TestJobMetrics_InFlightNilSafe covers the driver code path where metrics are not
// wired (e.g. &jobDriver{} in tests) — Inc/Dec must not panic on a nil receiver or a
// zero-value struct.
func TestJobMetrics_InFlightNilSafe(t *testing.T) {
	var nilMetrics *JobMetrics
	require.NotPanics(t, func() {
		nilMetrics.IncInFlight("0", "pull")
		nilMetrics.DecInFlight("0", "pull")
	})

	zero := &JobMetrics{} // inFlight is nil
	require.NotPanics(t, func() {
		zero.IncInFlight("0", "pull")
		zero.DecInFlight("0", "pull")
	})
}

func TestQueueMetrics_RecordClaim(t *testing.T) {
	m := &QueueMetrics{
		claimTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{Name: "test_jobs_claim_total"},
			[]string{"outcome"},
		),
	}
	m.RecordClaim(ClaimOutcomeClaimed)
	m.RecordClaim(ClaimOutcomeClaimed)
	m.RecordClaim(ClaimOutcomeEmpty)

	require.Equal(t, 2.0, testutil.ToFloat64(m.claimTotal.WithLabelValues(ClaimOutcomeClaimed)))
	require.Equal(t, 1.0, testutil.ToFloat64(m.claimTotal.WithLabelValues(ClaimOutcomeEmpty)))
	require.Equal(t, 0.0, testutil.ToFloat64(m.claimTotal.WithLabelValues(ClaimOutcomeContended)))
}

// TestQueueMetrics_RecordClaimNilSafe covers stores built without a registered claim
// counter (e.g. QueueMetrics{queueWaitTime: nil} in tests).
func TestQueueMetrics_RecordClaimNilSafe(t *testing.T) {
	zero := &QueueMetrics{} // claimTotal is nil
	require.NotPanics(t, func() { zero.RecordClaim(ClaimOutcomeClaimed) })
}

// TestJobMetrics_RecordJobDurationOnAllOutcomes verifies duration is observed for
// failures too (so slow+failing jobs are visible), bucketed under a sentinel since a
// failed job's resource count is not meaningful.
func TestJobMetrics_RecordJobDurationOnAllOutcomes(t *testing.T) {
	m := &JobMetrics{
		processedTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{Name: "test_jobs_processed_total"}, []string{"action", "outcome"}),
		durationHist: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{Name: "test_jobs_duration_seconds", Buckets: []float64{5, 10}},
			[]string{"action", "resources_changed_bucket", "outcome"}),
	}

	m.RecordJob("pull", utils.SuccessOutcome, 3, 2.0)
	m.RecordJob("pull", utils.ErrorOutcome, 0, 7.0)
	m.RecordJob("pull", "warning", 5, 3.0) // string(provisioning.JobStateWarning)

	// All three outcomes recorded a duration series (before, only success did).
	require.Equal(t, 3, testutil.CollectAndCount(m.durationHist))
	// Success and warning keep their resource-count bucket; only failure uses the sentinel.
	require.Equal(t, uint64(1), histSampleCount(t, m.durationHist, "pull", utils.GetResourceCountBucket(3), utils.SuccessOutcome))
	require.Equal(t, uint64(1), histSampleCount(t, m.durationHist, "pull", utils.GetResourceCountBucket(5), "warning"))
	require.Equal(t, uint64(1), histSampleCount(t, m.durationHist, "pull", durationBucketUnknown, utils.ErrorOutcome))
}

package lease_test

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

func TestMetricsAcquireRelease(t *testing.T) {
	m := lease.NewManager(newMapKV(), "holder-ar", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
	)
	metrics := m.Metrics()

	l, err := m.Acquire(t.Context(), "metrics/acquire-release")
	require.NoError(t, err)
	require.NoError(t, m.Release(t.Context(), l))

	// Total acquire/release call counts are derived from the duration
	// histograms' _count series.
	require.Equal(t, uint64(1), histogramVecCount(t, metrics.AcquireDuration, "success"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.AcquireDuration, "already_held"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.AcquireDuration, "error"))
	require.Equal(t, uint64(1), histogramVecCount(t, metrics.ReleaseDuration, "success"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.ReleaseDuration, "lost"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.ReleaseDuration, "error"))

	// No retries observed when no contention occurred.
	require.Equal(t, uint64(0), histogramCount(t, metrics.AcquireRetries))

	// Graceful release must NOT count as a loss under any reason.
	requireNoLosses(t, metrics)
}

func TestMetricsAcquireErrorOutcome(t *testing.T) {
	m := lease.NewManager(newMapKV(), "holder-err", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
	)
	metrics := m.Metrics()

	// Invalid name → Acquire returns before the retry loop. Duration is still
	// observed with outcome=error.
	_, err := m.Acquire(t.Context(), "")
	require.Error(t, err)

	require.Equal(t, uint64(0), histogramVecCount(t, metrics.AcquireDuration, "success"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.AcquireDuration, "already_held"))
	require.Equal(t, uint64(1), histogramVecCount(t, metrics.AcquireDuration, "error"))
}

func TestMetricsAcquireAlreadyHeldOutcome(t *testing.T) {
	m := lease.NewManager(newMapKV(), "holder-already-held", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
	)
	metrics := m.Metrics()

	// First acquire succeeds; second acquire of the same name returns
	// ErrLeaseAlreadyHeld.
	l, err := m.Acquire(t.Context(), "metrics/already-held")
	require.NoError(t, err)
	t.Cleanup(func() { _ = m.Release(t.Context(), l) })

	_, err = m.Acquire(t.Context(), "metrics/already-held")
	require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)

	require.Equal(t, uint64(1), histogramVecCount(t, metrics.AcquireDuration, "success"))
	require.Equal(t, uint64(1), histogramVecCount(t, metrics.AcquireDuration, "already_held"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.AcquireDuration, "error"))
}

func TestMetricsReleaseLostOutcome(t *testing.T) {
	const ttl = 50 * time.Millisecond

	m := lease.NewManager(newMapKV(), "holder-release-lost", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
		lease.WithInternalMinTTL(ttl),
	)
	metrics := m.Metrics()

	l, err := m.Acquire(t.Context(), "metrics/release-lost", lease.WithTTL(ttl))
	require.NoError(t, err)

	// Wait for the lease to expire so Release returns ErrLeaseLost.
	select {
	case <-l.Lost():
	case <-time.After(ttl + 2*time.Second):
		t.Fatal("Lost() did not fire after expiry")
	}

	err = m.Release(t.Context(), l)
	require.ErrorIs(t, err, lease.ErrLeaseLost)

	require.Equal(t, uint64(0), histogramVecCount(t, metrics.ReleaseDuration, "success"))
	require.Equal(t, uint64(1), histogramVecCount(t, metrics.ReleaseDuration, "lost"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.ReleaseDuration, "error"))
}

func TestMetricsAcquireRetries(t *testing.T) {
	failing := &retryKV{KV: newMapKV()}
	m := lease.NewManager(failing, "holder-retry", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
	)
	metrics := m.Metrics()

	// First Batch call fails with ErrKeyAlreadyExists, forcing the loop to
	// retry exactly once.
	l, err := m.Acquire(t.Context(), "metrics/retry")
	require.NoError(t, err)
	require.NoError(t, m.Release(t.Context(), l))

	require.Equal(t, uint64(1), histogramCount(t, metrics.AcquireRetries))
	require.Equal(t, 1.0, histogramSum(t, metrics.AcquireRetries))
}

func TestMetricsLossOnExpiry(t *testing.T) {
	const ttl = 50 * time.Millisecond

	m := lease.NewManager(newMapKV(), "holder-loss", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
		lease.WithInternalMinTTL(ttl),
	)
	metrics := m.Metrics()

	l, err := m.Acquire(t.Context(), "metrics/loss", lease.WithTTL(ttl))
	require.NoError(t, err)

	select {
	case <-l.Lost():
	case <-time.After(ttl + 2*time.Second):
		t.Fatal("Lost() did not fire after expiry")
	}

	require.Equal(t, 1.0, testutil.ToFloat64(metrics.LossesTotal.WithLabelValues("expired")))
	require.Equal(t, 0.0, testutil.ToFloat64(metrics.LossesTotal.WithLabelValues("lost")))
	require.Equal(t, 0.0, testutil.ToFloat64(metrics.LossesTotal.WithLabelValues("error")))
}

func TestMetricsRenewalSuccess(t *testing.T) {
	const ttl = 100 * time.Millisecond

	m := lease.NewManager(newMapKV(), "holder-renew", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
		lease.WithInternalMinTTL(ttl),
	)
	metrics := m.Metrics()

	l, err := m.Acquire(t.Context(), "metrics/renew", lease.WithTTL(ttl), lease.WithAutoRenew())
	require.NoError(t, err)

	// renewInterval = ttl/3, so we should see at least one renewal quickly.
	require.Eventually(t, func() bool {
		return testutil.ToFloat64(metrics.RenewalsTotal) >= 1
	}, ttl*5, ttl/3)

	require.NoError(t, m.Release(t.Context(), l))

	requireNoLosses(t, metrics)
}

func TestMetricsRenewalFailureLost(t *testing.T) {
	const ttl = 100 * time.Millisecond

	store := newMapKV()
	a := lease.NewManager(store, "holder-a", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
		lease.WithInternalMinTTL(ttl),
	)
	metrics := a.Metrics()

	l, err := a.Acquire(t.Context(), "metrics/renew-lost", lease.WithTTL(ttl), lease.WithAutoRenew())
	require.NoError(t, err)

	// b uses a clock far in the future so it sees a's (still actively renewed)
	// lease as expired and can steal the next generation slot. The next time
	// a's renewal goroutine ticks it tries to create the same generation key
	// and fails with ErrLeaseLost.
	future := func() time.Time { return time.Now().Add(time.Hour) }
	b := lease.NewManager(store, "holder-b", nil,
		lease.WithGarbageCollectionDisabled,
		lease.WithInternalMinTTL(ttl),
		lease.WithInternalNowFunc(future),
	)
	_, err = b.Acquire(t.Context(), "metrics/renew-lost", lease.WithTTL(ttl))
	require.NoError(t, err)

	select {
	case <-l.Lost():
	case <-time.After(ttl + 2*time.Second):
		t.Fatal("Lost() did not fire after stolen lease")
	}

	require.Equal(t, 1.0, testutil.ToFloat64(metrics.LossesTotal.WithLabelValues("lost")))
	require.Equal(t, 0.0, testutil.ToFloat64(metrics.LossesTotal.WithLabelValues("expired")))
	require.Equal(t, 0.0, testutil.ToFloat64(metrics.LossesTotal.WithLabelValues("error")))
}

func TestMetricsGCExecuted(t *testing.T) {
	m := lease.NewManager(newMapKV(), "holder-gc-exec", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
	)
	metrics := m.Metrics()

	_, err := m.RunGarbageCollection(t.Context())
	require.NoError(t, err)

	require.Equal(t, uint64(1), histogramVecCount(t, metrics.GCDurationSeconds, "executed"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.GCDurationSeconds, "skipped"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.GCDurationSeconds, "error"))
}

func TestMetricsGCSkipped(t *testing.T) {
	store := newMapKV()
	// Simulate another GC instance currently holding the internal key.
	writeGCInternalKey(t, store, time.Now().Add(time.Minute))

	m := lease.NewManager(store, "holder-gc-skip", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
	)
	metrics := m.Metrics()

	_, err := m.RunGarbageCollection(t.Context())
	require.NoError(t, err)

	require.Equal(t, uint64(0), histogramVecCount(t, metrics.GCDurationSeconds, "executed"))
	require.Equal(t, uint64(1), histogramVecCount(t, metrics.GCDurationSeconds, "skipped"))
	require.Equal(t, uint64(0), histogramVecCount(t, metrics.GCDurationSeconds, "error"))
}

func TestMetricsGCScannedAndDeleted(t *testing.T) {
	const shortTTL = time.Millisecond
	ctx := t.Context()

	store := newMapKV()
	base := time.Now().Add(-10 * time.Minute)
	now := base
	nowFunc := func() time.Time { return now }

	m := lease.NewManager(store, "holder-gc-counts", prometheus.NewPedanticRegistry(),
		lease.WithGarbageCollectionDisabled,
		lease.WithInternalMinTTL(shortTTL),
		lease.WithInternalNowFunc(nowFunc),
	)
	metrics := m.Metrics()

	// One released lease and one expired lease, both well in the past.
	released, err := m.Acquire(ctx, "metrics/gc/released")
	require.NoError(t, err)
	require.NoError(t, m.Release(ctx, released))

	_, err = m.Acquire(ctx, "metrics/gc/expired", lease.WithTTL(shortTTL))
	require.NoError(t, err)

	// Advance the clock past the GC grace period.
	now = time.Now()

	deleted, err := m.RunGarbageCollection(ctx)
	require.NoError(t, err)
	require.Equal(t, 2, deleted)

	require.Equal(t, 2.0, testutil.ToFloat64(metrics.GCKeysScannedTotal))
	require.Equal(t, 2.0, testutil.ToFloat64(metrics.GCKeysDeletedTotal))
}

// requireNoLosses asserts that no loss-reason label has been incremented.
func requireNoLosses(t *testing.T, metrics *lease.Metrics) {
	t.Helper()
	for _, reason := range []string{"expired", "lost", "error"} {
		require.Equal(t, 0.0, testutil.ToFloat64(metrics.LossesTotal.WithLabelValues(reason)),
			"unexpected loss recorded with reason=%q", reason)
	}
}

// retryKV wraps a KV and rejects the first Batch call with
// kv.ErrKeyAlreadyExists, forcing Acquire's retry loop to spin once.
type retryKV struct {
	kv.KV
	failed atomic.Bool
}

func (r *retryKV) Batch(ctx context.Context, section string, ops []kv.BatchOp) error {
	if !r.failed.Swap(true) {
		return kv.ErrKeyAlreadyExists
	}
	return r.KV.Batch(ctx, section, ops)
}

// writeGCInternalKey writes a fake lease-internal/gc key directly into the
// store so that a subsequent runOnce sees another instance "holding" the GC
// lock and takes the skip path.
func writeGCInternalKey(t *testing.T, store kv.KV, expires time.Time) {
	t.Helper()
	data := []byte(fmt.Sprintf(`{"expires":%d}`, expires.UnixNano()))
	w, err := store.Save(t.Context(), kv.LeasesSection, "lease-internal/gc")
	require.NoError(t, err)
	_, err = w.Write(data)
	require.NoError(t, err)
	require.NoError(t, w.Close())
}

// histogramCount returns the sample count of a Histogram by writing it to a
// protobuf metric.
func histogramCount(t *testing.T, h prometheus.Histogram) uint64 {
	t.Helper()
	return writeHistogram(t, h).GetSampleCount()
}

// histogramSum returns the cumulative sum of observations in a Histogram.
func histogramSum(t *testing.T, h prometheus.Histogram) float64 {
	t.Helper()
	return writeHistogram(t, h).GetSampleSum()
}

// histogramVecCount returns the sample count of a single label combination in
// a HistogramVec.
func histogramVecCount(t *testing.T, vec *prometheus.HistogramVec, labelValues ...string) uint64 {
	t.Helper()
	obs, err := vec.GetMetricWithLabelValues(labelValues...)
	require.NoError(t, err)
	return histogramCount(t, obs.(prometheus.Histogram))
}

func writeHistogram(t *testing.T, h prometheus.Histogram) *dto.Histogram {
	t.Helper()
	var m dto.Metric
	require.NoError(t, h.Write(&m))
	require.NotNil(t, m.Histogram)
	return m.Histogram
}

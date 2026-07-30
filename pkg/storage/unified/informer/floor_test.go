package informer

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Realistic snowflake-range resource versions (above the legacy threshold), so
// the tests exercise the same numeric space production RVs live in.
const (
	rvStale = int64(200000000000000000)
	rvFresh = int64(300000000000000000)
)

func objWithRV(name string, rv int64) *metav1.PartialObjectMetadata {
	o := obj(name)
	o.ResourceVersion = formatRV(rv)
	return o
}

func formatRV(rv int64) string {
	return strconv.FormatInt(rv, 10)
}

func TestRVFloor_RaiseIsMonotonic(t *testing.T) {
	f := NewRVFloor()

	f.Raise("ns", "r", rvFresh)
	f.Raise("ns", "r", rvStale)
	assert.Equal(t, rvFresh, f.Floor("ns", "r"), "a lower announcement must not lower the floor")

	f.Raise("ns", "r", rvFresh+1)
	assert.Equal(t, rvFresh+1, f.Floor("ns", "r"))

	assert.Zero(t, f.Floor("ns", "other"), "keys without announcements have no floor")
}

func TestRVFloor_SettleKeepsHigherFloor(t *testing.T) {
	f := NewRVFloor()

	f.Raise("ns", "r", rvStale)
	f.Settle("ns", "r", rvStale)
	assert.Zero(t, f.Floor("ns", "r"), "a read at the floor settles it")

	f.Raise("ns", "r", rvFresh)
	f.Settle("ns", "r", rvStale)
	assert.Equal(t, rvFresh, f.Floor("ns", "r"), "a read below a raised floor must not settle it")
}

// Wire versions are snowflakes; rows unwritten since migration can still read
// back legacy microsecond versions. Both must land in one comparable space.
func TestRVFloor_NormalizesLegacyVersions(t *testing.T) {
	f := NewRVFloor()
	legacy := int64(1_700_000_000_000_123) // microsecond-timestamp form, below the snowflake threshold

	f.Raise("ns", "r", legacy)
	assert.Equal(t, resource.ToSnowflakeRV(legacy), f.Floor("ns", "r"), "legacy versions are stored in snowflake form")

	f.Settle("ns", "r", legacy)
	assert.Zero(t, f.Floor("ns", "r"), "a legacy read at a legacy floor settles it")
}

// An orphaned floor (its delete was delivered to another replica and the object
// never entered a snapshot) is dropped after the TTL instead of leaking.
func TestRVFloor_SweepDropsExpiredEntries(t *testing.T) {
	f := NewRVFloor()
	now := time.Now()
	f.now = func() time.Time { return now }

	f.Raise("ns", "orphan", rvFresh)
	now = now.Add(floorTTL + sweepInterval)
	f.Raise("ns", "live", rvFresh)

	assert.Zero(t, f.Floor("ns", "orphan"), "expired floors are swept")
	assert.Equal(t, rvFresh, f.Floor("ns", "live"))
}

// Expiry must not depend on Raise traffic: with no events at all, a read past
// the TTL drops the orphan instead of returning it, so a legitimate 404 stops
// classifying as stale and the entry's memory is reclaimed.
func TestRVFloor_ExpiredFloorNotReturnedOnRead(t *testing.T) {
	f := NewRVFloor()
	now := time.Now()
	f.now = func() time.Time { return now }

	f.Raise("ns", "orphan", rvFresh)
	now = now.Add(floorTTL + time.Second)

	assert.Zero(t, f.Floor("ns", "orphan"), "an expired floor must not be returned")
	assert.Empty(t, f.floors, "the expired entry must be dropped, not just hidden")
}

func TestRVFloor_ReRaiseKeepsEntryAlive(t *testing.T) {
	f := NewRVFloor()
	now := time.Now()
	f.now = func() time.Time { return now }

	f.Raise("ns", "r", rvFresh)
	// Re-announced (e.g. by a re-list) just before expiry: the age refreshes even
	// though the floor value does not move.
	now = now.Add(floorTTL - time.Minute)
	f.Raise("ns", "r", rvStale)
	now = now.Add(floorTTL - time.Minute)
	f.Raise("ns", "other", rvFresh) // trigger a sweep

	assert.Equal(t, rvFresh, f.Floor("ns", "r"), "a re-announced floor must not expire")
}

func notFound(name string) error {
	return apierrors.NewNotFound(testGVR.GroupResource(), name)
}

// A fetch below the announced floor is re-read until the API serves the
// announced version, which then settles the floor.
func TestGetFresh_WaitsForFloor(t *testing.T) {
	floor := NewRVFloor()
	floor.Raise(testNamespace, "r", rvFresh)

	fetches := 0
	got, err := GetFresh(context.Background(), FreshReader{Floor: floor, Retries: 3}, testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			fetches++
			if fetches == 1 {
				return objWithRV("r", rvStale), nil
			}
			return objWithRV("r", rvFresh), nil
		})
	require.NoError(t, err)
	assert.Equal(t, formatRV(rvFresh), got.ResourceVersion)
	assert.Equal(t, 2, fetches, "the stale first read must be retried")
	assert.Equal(t, rvFresh, floor.Floor(testNamespace, "r"), "the floor persists as the observed watermark")
}

// A met floor is not settled by the read: the reconcile attempt may still fail
// and be retried, and the retry must not accept a read below what the first
// attempt already observed.
func TestGetFresh_RetainsFloorAcrossAttempts(t *testing.T) {
	floor := NewRVFloor()
	floor.Raise(testNamespace, "r", rvFresh)
	reader := FreshReader{Floor: floor, Retries: 2}

	// First attempt reads fresh state.
	_, err := GetFresh(context.Background(), reader, testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			return objWithRV("r", rvFresh), nil
		})
	require.NoError(t, err)

	// The retry lands on a lagging replica: the watermark must reject it.
	_, err = GetFresh(context.Background(), reader, testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			return objWithRV("r", rvStale), nil
		})
	require.ErrorIs(t, err, ErrStaleRead)

	// A stale 404 on the retry must not read as a trusted delete either.
	_, err = GetFresh(context.Background(), reader, testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			return nil, notFound("r")
		})
	require.ErrorIs(t, err, ErrStaleRead)
	assert.False(t, apierrors.IsNotFound(err))
}

func TestRVFloor_Below(t *testing.T) {
	f := NewRVFloor()
	assert.False(t, f.Below("ns", "r", rvStale), "no floor indicts no read")

	f.Raise("ns", "r", rvFresh)
	assert.True(t, f.Below("ns", "r", rvStale))
	assert.False(t, f.Below("ns", "r", rvFresh))
	assert.False(t, f.Below("ns", "r", rvFresh+1))
	assert.False(t, f.Below("ns", "r", 0), "an unparseable version fails open")
}

// A read that never catches up surfaces ErrStaleRead and keeps the floor, so
// the caller can requeue and try again rather than act on stale state.
func TestGetFresh_ExhaustsToErrStaleRead(t *testing.T) {
	floor := NewRVFloor()
	floor.Raise(testNamespace, "r", rvFresh)

	fetches := 0
	_, err := GetFresh(context.Background(), FreshReader{Floor: floor, Retries: 3}, testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			fetches++
			return objWithRV("r", rvStale), nil
		})
	require.ErrorIs(t, err, ErrStaleRead)
	assert.Equal(t, 3, fetches)
	assert.Equal(t, rvFresh, floor.Floor(testNamespace, "r"), "an unmet floor must stay for the retry")
}

// A 404 while a floor says the object exists is a stale read: it must surface
// as ErrStaleRead, not as a trusted NotFound.
func TestGetFresh_NotFoundBelowFloorIsStale(t *testing.T) {
	floor := NewRVFloor()
	floor.Raise(testNamespace, "r", rvFresh)

	_, err := GetFresh(context.Background(), FreshReader{Floor: floor, Retries: 3}, testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			return nil, notFound("r")
		})
	require.ErrorIs(t, err, ErrStaleRead)
	assert.False(t, apierrors.IsNotFound(err), "a stale 404 must not read as a trusted delete")
}

// With no floor outstanding a 404 is trusted and returned as is.
func TestGetFresh_TrustedNotFound(t *testing.T) {
	_, err := GetFresh(context.Background(), NewFreshReader(NewRVFloor()), testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			return nil, notFound("r")
		})
	require.True(t, apierrors.IsNotFound(err))
}

// A nil floor disables enforcement entirely: one fetch, returned as is.
func TestGetFresh_NilFloorPassesThrough(t *testing.T) {
	fetches := 0
	got, err := GetFresh(context.Background(), NewFreshReader(nil), testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			fetches++
			return objWithRV("r", rvStale), nil
		})
	require.NoError(t, err)
	assert.Equal(t, 1, fetches)
	assert.Equal(t, formatRV(rvStale), got.ResourceVersion)
}

// An object whose version does not parse fails open: enforcement cannot apply,
// so it is returned rather than spun on.
func TestGetFresh_UnparseableVersionFailsOpen(t *testing.T) {
	floor := NewRVFloor()
	floor.Raise(testNamespace, "r", rvFresh)

	got, err := GetFresh(context.Background(), FreshReader{Floor: floor, Retries: 3}, testNamespace, "r",
		func(context.Context) (*metav1.PartialObjectMetadata, error) {
			return obj("r"), nil
		})
	require.NoError(t, err)
	assert.Empty(t, got.ResourceVersion)
	assert.Equal(t, rvFresh, floor.Floor(testNamespace, "r"), "an unenforceable read must not settle the floor")
}

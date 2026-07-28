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
	"k8s.io/client-go/tools/cache"

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

func TestRVFloor_Forget(t *testing.T) {
	f := NewRVFloor()
	f.Raise("ns", "r", rvFresh)
	f.Forget("ns", "r")
	assert.Zero(t, f.Floor("ns", "r"))
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

// countingHandler records delegated calls so the wrapper's pass-through can be
// asserted alongside its floor bookkeeping.
type countingHandler struct{ adds, updates, deletes int }

func (h *countingHandler) OnAdd(interface{}, bool)   { h.adds++ }
func (h *countingHandler) OnUpdate(_, _ interface{}) { h.updates++ }
func (h *countingHandler) OnDelete(interface{})      { h.deletes++ }

var _ cache.ResourceEventHandler = (*countingHandler)(nil)

func TestFloorTrackingHandler(t *testing.T) {
	floor := NewRVFloor()
	next := &countingHandler{}
	h := floorTrackingHandler{next: next, floor: floor}

	h.OnAdd(objWithRV("r", rvStale), false)
	assert.Equal(t, rvStale, floor.Floor(testNamespace, "r"), "OnAdd raises the floor to the announced version")

	h.OnUpdate(objWithRV("r", rvStale), objWithRV("r", rvFresh))
	assert.Equal(t, rvFresh, floor.Floor(testNamespace, "r"), "OnUpdate raises the floor from the new object")

	h.OnAdd(obj("unversioned"), false)
	assert.Zero(t, floor.Floor(testNamespace, "unversioned"), "objects without a parseable version do not move the floor")

	h.OnDelete(objWithRV("r", rvFresh))
	assert.Zero(t, floor.Floor(testNamespace, "r"), "OnDelete forgets the floor")

	require.Equal(t, 2, next.adds)
	require.Equal(t, 1, next.updates)
	require.Equal(t, 1, next.deletes)
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
	assert.Zero(t, floor.Floor(testNamespace, "r"), "a met floor must settle")
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

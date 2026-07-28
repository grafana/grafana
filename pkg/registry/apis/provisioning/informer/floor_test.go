package informer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

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

	h.OnAdd(repoWithRV("ns", "r", rvStale), false)
	assert.Equal(t, rvStale, floor.Floor("ns", "r"), "OnAdd raises the floor to the announced version")

	h.OnUpdate(repoWithRV("ns", "r", rvStale), repoWithRV("ns", "r", rvFresh))
	assert.Equal(t, rvFresh, floor.Floor("ns", "r"), "OnUpdate raises the floor from the new object")

	h.OnAdd(repo("ns", "unversioned"), false)
	assert.Zero(t, floor.Floor("ns", "unversioned"), "objects without a parseable version do not move the floor")

	h.OnDelete(repoWithRV("ns", "r", rvFresh))
	assert.Zero(t, floor.Floor("ns", "r"), "OnDelete forgets the floor")

	require.Equal(t, 2, next.adds)
	require.Equal(t, 1, next.updates)
	require.Equal(t, 1, next.deletes)
}

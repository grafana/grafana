package informer

import (
	"errors"
	"strconv"
	"sync"
	"time"

	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ErrStaleRead reports that a reconcile read could not observe the object at
// least as fresh as the resource version announced by the informer event that
// triggered it. The event's version is a committed write, so the read raced a
// replication/visibility lag rather than hit missing state: the caller should
// retry the key, not treat the result as current.
var ErrStaleRead = errors.New("read is staler than the announced resource version")

const (
	// floorTTL bounds how long an unmet floor is remembered. A floor normally
	// clears when a read meets it or a delete event forgets it, but a hard delete
	// round-robined to another replica for an object that never entered a re-list
	// snapshot would leave its floor orphaned forever; by TTL time the periodic
	// re-list has long since delivered the truth, so dropping it is safe.
	floorTTL = 15 * time.Minute
	// sweepInterval is how often Raise scans for expired floors, so expiry cost
	// is amortized over the event stream instead of paid per call.
	sweepInterval = time.Minute
)

// RVFloor tracks, per object, the highest resource version any informer event
// has announced — the freshness floor a reconcile read must reach before its
// result can be trusted as current. Notifications carry the version of a
// committed write, so a subsequent read returning less is a stale replica, not
// truth.
//
// Versions are normalized to snowflake form on the way in (Raise/Settle), so
// wire versions (always snowflake) and read versions (possibly legacy
// microsecond values for rows unwritten since migration) compare in one space.
type RVFloor struct {
	mu        sync.Mutex
	floors    map[string]floorEntry
	lastSweep time.Time
	now       func() time.Time // injected in tests
}

type floorEntry struct {
	rv       int64
	raisedAt time.Time
}

func NewRVFloor() *RVFloor {
	return &RVFloor{floors: map[string]floorEntry{}, now: time.Now}
}

// Raise records rv as the key's floor if it is higher than the current one, and
// refreshes the entry's age either way: a floor that keeps being re-announced
// (e.g. by every re-list) is live evidence and must not expire underneath it.
func (f *RVFloor) Raise(namespace, name string, rv int64) {
	if rv <= 0 {
		return
	}
	rv = resource.ToSnowflakeRV(rv)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sweepLocked()
	key := floorKey(namespace, name)
	if e, ok := f.floors[key]; ok && e.rv > rv {
		rv = e.rv
	}
	f.floors[key] = floorEntry{rv: rv, raisedAt: f.now()}
}

// Floor returns the key's current floor, or 0 when none is outstanding.
func (f *RVFloor) Floor(namespace, name string) int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.floors[floorKey(namespace, name)].rv
}

// Settle drops the floor once a read at rv has met it. A floor raised above rv
// in the meantime is kept, so the next reconcile still has to catch up to it.
func (f *RVFloor) Settle(namespace, name string, rv int64) {
	rv = resource.ToSnowflakeRV(rv)
	f.mu.Lock()
	defer f.mu.Unlock()
	key := floorKey(namespace, name)
	if e, ok := f.floors[key]; ok && e.rv <= rv {
		delete(f.floors, key)
	}
}

// Forget drops the floor unconditionally — for delete events, where the object
// is gone and no read is expected to reach any version.
func (f *RVFloor) Forget(namespace, name string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.floors, floorKey(namespace, name))
}

func (f *RVFloor) sweepLocked() {
	now := f.now()
	if now.Sub(f.lastSweep) < sweepInterval {
		return
	}
	f.lastSweep = now
	for k, e := range f.floors {
		if now.Sub(e.raisedAt) > floorTTL {
			delete(f.floors, k)
		}
	}
}

func floorKey(namespace, name string) string {
	return namespace + "/" + name
}

// withRVFloor wraps a delta source so every delivered event maintains the floor
// before the wrapped handler runs: adds and updates raise it to the object's
// announced version, deletes forget it. Raising first means that by the time a
// controller's handler enqueues the key, the floor its reconcile read must meet
// is already in place.
func withRVFloor(source DeltaSource, floor *RVFloor) DeltaSource {
	return floorTrackingSource{DeltaSource: source, floor: floor}
}

type floorTrackingSource struct {
	DeltaSource
	floor *RVFloor
}

func (s floorTrackingSource) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	return s.DeltaSource.AddEventHandler(floorTrackingHandler{next: handler, floor: s.floor})
}

type floorTrackingHandler struct {
	next  cache.ResourceEventHandler
	floor *RVFloor
}

func (h floorTrackingHandler) OnAdd(obj interface{}, isInInitialList bool) {
	h.raise(obj)
	h.next.OnAdd(obj, isInInitialList)
}

func (h floorTrackingHandler) OnUpdate(oldObj, newObj interface{}) {
	h.raise(newObj)
	h.next.OnUpdate(oldObj, newObj)
}

func (h floorTrackingHandler) OnDelete(obj interface{}) {
	if acc, err := apimeta.Accessor(obj); err == nil {
		h.floor.Forget(acc.GetNamespace(), acc.GetName())
	}
	h.next.OnDelete(obj)
}

// raise lifts the floor to the object's resource version. Objects without a
// parseable version (never expected from the NATS informer, which stamps live
// events and re-lists full objects) simply don't move the floor, so a missing
// version degrades to today's unchecked behavior rather than blocking reads.
func (h floorTrackingHandler) raise(obj interface{}) {
	acc, err := apimeta.Accessor(obj)
	if err != nil {
		return
	}
	rv, err := strconv.ParseInt(acc.GetResourceVersion(), 10, 64)
	if err != nil {
		return
	}
	h.floor.Raise(acc.GetNamespace(), acc.GetName(), rv)
}

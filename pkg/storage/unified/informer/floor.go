package informer

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"

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
	// re-list has long since delivered the truth, so dropping it is safe. Expiry
	// is enforced at both touch points: Floor drops an expired entry rather than
	// return it (so an orphan cannot outlive the TTL just because no event
	// traffic triggers a sweep), and Raise amortizes a full sweep over the event
	// stream to bound memory for keys nobody reads again.
	floorTTL = 15 * time.Minute
	// sweepInterval is how often Raise scans for expired floors, so expiry cost
	// is amortized over the event stream instead of paid per call.
	sweepInterval = time.Minute

	// defaultStaleReadRetries and defaultStaleReadBackoff bound how long GetFresh
	// waits in place for the API to catch up to an announced resource version.
	// They cover the common case of a short replication lag; anything longer
	// surfaces as ErrStaleRead so the caller's workqueue (and ultimately the
	// periodic re-list) takes over the retrying.
	defaultStaleReadRetries = 4
	defaultStaleReadBackoff = 250 * time.Millisecond
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

// Floor returns the key's current floor, or 0 when none is outstanding. An
// entry past its TTL is dropped and reported absent: a legitimate 404 must stop
// reading as stale once the TTL passes, even on an informer idle enough that no
// Raise ever runs the sweep.
func (f *RVFloor) Floor(namespace, name string) int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	key := floorKey(namespace, name)
	e, ok := f.floors[key]
	if !ok {
		return 0
	}
	if f.now().Sub(e.raisedAt) > floorTTL {
		delete(f.floors, key)
		return 0
	}
	return e.rv
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

// FreshReader bundles a freshness floor with the retry policy GetFresh uses to
// wait out visibility lag. Build one with NewFreshReader for the defaults; the
// fields are exported so tests can tighten them.
type FreshReader struct {
	// Floor is the freshness floor informer events raise; nil disables the check.
	Floor *RVFloor
	// Retries is the total number of reads before giving up with ErrStaleRead.
	Retries int
	// Backoff is the wait between reads.
	Backoff time.Duration
}

func NewFreshReader(floor *RVFloor) FreshReader {
	return FreshReader{Floor: floor, Retries: defaultStaleReadRetries, Backoff: defaultStaleReadBackoff}
}

// GetFresh fetches an object until the read is at least as fresh as the key's
// floor, so a reconcile never acts on state older than the event that woke it.
//
//   - a read at or above the floor settles it and is returned;
//   - a read below it — or a NotFound while a floor says the object exists — is
//     a visibility lag: re-read up to Retries times, then return ErrStaleRead
//     (which deliberately does not wrap the NotFound, so callers don't mistake a
//     stale 404 for a trusted delete);
//   - a NotFound with no floor outstanding is trusted and returned as is;
//   - an object whose version does not parse fails open: enforcement cannot
//     apply, so it is returned rather than spun on.
func GetFresh[T runtime.Object](ctx context.Context, r FreshReader, namespace, name string, fetch func(context.Context) (T, error)) (T, error) {
	var zero T
	if r.Retries < 1 {
		r.Retries = 1
	}
	var floor int64
	if r.Floor != nil {
		floor = r.Floor.Floor(namespace, name)
	}

	for attempt := 0; ; attempt++ {
		obj, err := fetch(ctx)
		switch {
		case apierrors.IsNotFound(err) && floor == 0:
			return zero, err
		case err != nil && !apierrors.IsNotFound(err):
			return zero, err
		case err == nil:
			rv := objectRV(obj)
			if floor == 0 || rv == 0 || rv >= floor {
				if r.Floor != nil {
					r.Floor.Settle(namespace, name, rv)
				}
				return obj, nil
			}
		}

		// Below the floor (or 404 while an event says the object exists): the
		// announced write is committed but not visible to this read path yet.
		if attempt+1 >= r.Retries {
			return zero, fmt.Errorf("%w: %s/%s not visible at resource version %d after %d reads",
				ErrStaleRead, namespace, name, floor, attempt+1)
		}
		logging.FromContext(ctx).Info("reconcile read below announced resource version; retrying",
			"namespace", namespace, "name", name, "floor", floor, "attempt", attempt+1)
		select {
		case <-ctx.Done():
			return zero, ctx.Err()
		case <-time.After(r.Backoff):
		}
	}
}

// objectRV parses the object's resource version normalized to snowflake form,
// the same space RVFloor stores, so reads of rows that still carry
// legacy-format versions compare correctly against floors from the wire.
// Returns 0 when the version does not parse.
func objectRV(obj runtime.Object) int64 {
	acc, err := apimeta.Accessor(obj)
	if err != nil {
		return 0
	}
	rv, err := strconv.ParseInt(acc.GetResourceVersion(), 10, 64)
	if err != nil || rv <= 0 {
		return 0
	}
	return resource.ToSnowflakeRV(rv)
}

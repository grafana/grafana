package informer

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
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
	// floorTTL bounds how long a floor is remembered after its last raise. A
	// floor normally clears when a dated delete or re-list settles it, but a
	// hard delete round-robined to another replica for an object that never
	// entered a re-list snapshot would leave its floor orphaned forever — and
	// floors double as per-key read watermarks, so quiet keys hold an entry
	// until it ages out; by TTL time the periodic re-list has long since
	// delivered the truth. Expiry is enforced at both touch points: reads drop
	// an expired entry rather than return it (so an orphan cannot outlive the
	// TTL just because no event traffic triggers a sweep), and Raise amortizes a
	// full sweep over the event stream to bound memory for keys nobody reads
	// again.
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
// has announced or any fresh read has observed — the freshness floor a
// reconcile read must reach before its result can be trusted as current.
// Notifications carry the version of a committed write, so a subsequent read
// returning less is a stale replica, not truth; and once a read has observed a
// version, a later read (a retry of a failed reconcile, an internal
// re-schedule) below it is equally stale. A delete does not drop the watermark
// either — it flips it to a deletion watermark (Deleted), under which a
// NotFound is the expected truth but a pre-delete object served by a lagging
// replica is still rejected. Only the TTL ever removes an entry.
//
// Versions are normalized to snowflake form on the way in (Raise/Deleted), so
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
	deleted  bool
	raisedAt time.Time
}

func NewRVFloor() *RVFloor {
	return &RVFloor{floors: map[string]floorEntry{}, now: time.Now}
}

// Raise records rv as the key's floor if it is higher than the current one, and
// refreshes the entry's age either way: a floor that keeps being re-announced
// (e.g. by every re-list) is live evidence and must not expire underneath it.
// Raising above a deletion watermark marks the key live again — the
// announcement is a re-create newer than the delete.
func (f *RVFloor) Raise(namespace, name string, rv int64) {
	if rv <= 0 {
		return
	}
	rv = resource.ToSnowflakeRV(rv)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sweepLocked()
	key := floorKey(namespace, name)
	e, ok := f.floors[key]
	if !ok || rv > e.rv {
		e = floorEntry{rv: rv}
	}
	e.raisedAt = f.now()
	f.floors[key] = e
}

// Deleted records that the object was observed gone as of rv — a live delete's
// version, or the listRV of a re-list snapshot that no longer contains it. The
// watermark stays outstanding but flips meaning: a NotFound is now the expected
// truth, while an object read below rv is a pre-delete ghost from a lagging
// replica that must not be reconciled. A floor already raised above rv (a
// re-create whose events arrived first) is kept live — the delete is older
// evidence. rv <= 0 (an undatable list) records nothing.
func (f *RVFloor) Deleted(namespace, name string, rv int64) {
	if rv <= 0 {
		return
	}
	rv = resource.ToSnowflakeRV(rv)
	f.mu.Lock()
	defer f.mu.Unlock()
	key := floorKey(namespace, name)
	e, ok := f.floors[key]
	if ok && e.rv > rv {
		// Newer announcement outranks this delete; just refresh its age.
		e.raisedAt = f.now()
		f.floors[key] = e
		return
	}
	f.floors[key] = floorEntry{rv: rv, deleted: true, raisedAt: f.now()}
}

// Floor returns the key's current floor version, or 0 when none is
// outstanding, regardless of whether it marks a deletion. An entry past its TTL
// is dropped and reported absent: a legitimate 404 must stop reading as stale
// once the TTL passes, even on an informer idle enough that no Raise ever runs
// the sweep.
func (f *RVFloor) Floor(namespace, name string) int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	e := f.currentLocked(floorKey(namespace, name))
	return e.rv
}

// Watermark returns the key's outstanding floor version (0 when none) and
// whether it marks a deletion. For a live watermark a read must reach rv and a
// NotFound is suspect; for a deletion watermark a NotFound is the expected
// truth and only an object read below rv is stale (at or above it is a
// re-create).
func (f *RVFloor) Watermark(namespace, name string) (rv int64, deleted bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	e := f.currentLocked(floorKey(namespace, name))
	return e.rv, e.deleted
}

// Below reports whether rv is evidence of a stale read: a positive version
// strictly under the key's outstanding floor. No floor, or rv at/above it (or
// unparseable, rv <= 0), reports false — absence of a floor never indicts a
// read.
func (f *RVFloor) Below(namespace, name string, rv int64) bool {
	if rv <= 0 {
		return false
	}
	rv = resource.ToSnowflakeRV(rv)
	f.mu.Lock()
	defer f.mu.Unlock()
	e := f.currentLocked(floorKey(namespace, name))
	return e.rv > 0 && rv < e.rv
}

// currentLocked returns the key's entry, dropping (and reporting a zero entry)
// one past its TTL. Callers hold f.mu.
func (f *RVFloor) currentLocked(key string) floorEntry {
	e, ok := f.floors[key]
	if !ok {
		return floorEntry{}
	}
	if f.now().Sub(e.raisedAt) > floorTTL {
		delete(f.floors, key)
		return floorEntry{}
	}
	return e
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

// StaleReadMetrics counts freshness-floor enforcement, the signal for how
// often (and how badly) a read path lags the announced writes in practice:
//
//	grafana_provisioning_stale_read_retries_total{resource}
//	grafana_provisioning_stale_reads_exhausted_total{resource}
//
// A retry means a read (or claim) contradicted the floor and another attempt
// was scheduled; an exhaustion means the attempts ran out and the key was
// surrendered to the re-list backstop. Retries without exhaustions mean the
// floor is absorbing the lag; exhaustions mean the lag outlasts the retry
// budget.
type StaleReadMetrics struct {
	resource  string
	retries   *prometheus.CounterVec
	exhausted *prometheus.CounterVec
}

// NewStaleReadMetrics builds the counters on reg for the given resource label
// value, reusing collectors already registered on reg so several consumers
// share the families. A nil reg leaves them unregistered; a nil
// *StaleReadMetrics is safe to record on.
func NewStaleReadMetrics(reg prometheus.Registerer, resource string) *StaleReadMetrics {
	return &StaleReadMetrics{
		resource: resource,
		retries: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_stale_read_retries_total",
			Help: "Reads or claims rejected by the informer freshness floor (below the announced resource version, or a 404/claim outcome contradicting it) for which another attempt was scheduled, by resource.",
		}, []string{"resource"})),
		exhausted: registerOrReuse(reg, prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_provisioning_stale_reads_exhausted_total",
			Help: "Stale-read retry budgets that ran out, surrendering the key to the periodic re-list backstop, by resource.",
		}, []string{"resource"})),
	}
}

func (m *StaleReadMetrics) RecordRetried() {
	if m == nil {
		return
	}
	m.retries.WithLabelValues(m.resource).Inc()
}

func (m *StaleReadMetrics) RecordExhausted() {
	if m == nil {
		return
	}
	m.exhausted.WithLabelValues(m.resource).Inc()
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
	// Metrics counts stale-read outcomes; nil disables the accounting.
	Metrics *StaleReadMetrics
}

func NewFreshReader(floor *RVFloor, metrics *StaleReadMetrics) FreshReader {
	return FreshReader{Floor: floor, Retries: defaultStaleReadRetries, Backoff: defaultStaleReadBackoff, Metrics: metrics}
}

// GetFresh fetches an object until the read is at least as fresh as the key's
// floor, so a reconcile never acts on state older than the event that woke it.
//
//   - a read at or above the floor is returned, and the floor is raised to the
//     read's version: the reconcile attempt may still fail and be retried, and
//     the retry must not accept anything older than this attempt already saw
//     (a lagging replica could otherwise serve older state, or a 404 that would
//     read as a trusted delete);
//   - a read below the floor — or a NotFound while a live floor says the
//     object exists — is a visibility lag: re-read up to Retries times, then
//     return ErrStaleRead (which deliberately does not wrap the NotFound, so
//     callers don't mistake a stale 404 for a trusted delete);
//   - a NotFound with no floor outstanding, or under a deletion watermark (the
//     informer announced the delete, so the 404 is the truth), is trusted and
//     returned as is — while an object read below a deletion watermark is a
//     pre-delete ghost and treated as stale;
//   - an object whose version does not parse fails open: enforcement cannot
//     apply, so it is returned rather than spun on.
func GetFresh[T runtime.Object](ctx context.Context, r FreshReader, namespace, name string, fetch func(context.Context) (T, error)) (T, error) {
	var zero T
	if r.Retries < 1 {
		r.Retries = 1
	}
	var floor int64
	var deleted bool
	if r.Floor != nil {
		floor, deleted = r.Floor.Watermark(namespace, name)
	}

	for attempt := 0; ; attempt++ {
		obj, err := fetch(ctx)
		switch {
		case apierrors.IsNotFound(err) && (floor == 0 || deleted):
			return zero, err
		case err != nil && !apierrors.IsNotFound(err):
			return zero, err
		case err == nil:
			rv := objectRV(obj)
			if floor == 0 || rv == 0 || rv >= floor {
				if r.Floor != nil && rv > 0 {
					r.Floor.Raise(namespace, name, rv)
				}
				return obj, nil
			}
		}

		// Below the floor (or 404 while an event says the object exists): the
		// announced write is committed but not visible to this read path yet.
		if attempt+1 >= r.Retries {
			r.Metrics.RecordExhausted()
			return zero, fmt.Errorf("%w: %s/%s not visible at resource version %d after %d reads",
				ErrStaleRead, namespace, name, floor, attempt+1)
		}
		r.Metrics.RecordRetried()
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

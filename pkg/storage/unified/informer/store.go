package informer

import (
	"context"
	"sync"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"
)

// Cache is the read + write-through surface of a Store: read the current
// snapshot and write individual objects through between re-lists. A reader that
// keeps a count warm (e.g. a controller getter) takes this rather than the full
// Store.
type Cache interface {
	List(ctx context.Context) []runtime.Object
	Update(ctx context.Context, obj runtime.Object)
	Delete(ctx context.Context, namespace, name string)
}

// Store is the informer's snapshot of a resource kind, keyed by namespace/name.
// It is refreshed wholesale on each re-list (Replace) and can be written through
// between re-lists (Update/DeleteAt) by a caller that has just observed a fresh
// object. It is a staleness-tolerant view — never a source of truth for a read a
// reconcile depends on — meant for counts and other cheap, resync-cadence reads.
//
// The informer owns a Store (it refreshes it via Replace); a reader shares it as
// a Cache. Construct one with NewStore.
type Store interface {
	Cache
	// Replace swaps the store's contents for objs — the snapshot a LIST read at
	// listRV — and reports the diff against the previous snapshot as three sets:
	// added (keys not present before), updated (keys present before and now), and
	// removed (keys present before but absent now, carrying their last-known
	// state). The informer dispatches added as OnAdd — so add-only handlers still
	// wake for an object first seen by a re-list — updated as OnUpdate, and removed
	// as OnDelete.
	//
	// listRV reconciles the snapshot against live write-throughs that raced it: the
	// live subscription is open while the LIST runs, so a write can land after the
	// LIST read its snapshot. A live-added object newer than listRV is carried
	// forward rather than reported removed (the snapshot's silence about it is
	// stale, not authoritative), and a re-listed object a live delete newer than
	// listRV already evicted is suppressed rather than resurrected as a spurious
	// add. Pass 0 to disable this reconciliation (a plain wholesale swap).
	Replace(objs []runtime.Object, listRV int64) (added, updated, removed []runtime.Object)
	// Merge upserts objs into the store without removing keys absent from objs, and
	// reports the objects newly added and re-observed (updated), reconciled against
	// live-delete tombstones via listRV exactly as Replace reconciles its added
	// keys. It is the partial-re-list counterpart to Replace: a truncated list
	// (deliberately stopped early, e.g. under worker backpressure) must not make the
	// objects it did not read look deleted, so Merge never diffs for removals and
	// never expires tombstones for keys it did not read. added is dispatched as
	// OnAdd, updated as OnUpdate; there is no removed set.
	Merge(objs []runtime.Object, listRV int64) (added, updated []runtime.Object)
	// DeleteAt is the informer's live-delete write-through: it removes the object
	// and records a tombstone at rv (the delete's resource version) so a subsequent
	// re-list whose snapshot predates rv does not resurrect the just-deleted object
	// as a spurious add. The plain Cache.Delete (no rv) is for readers, which evict
	// on a NotFound they cannot date and so leave no tombstone.
	DeleteAt(ctx context.Context, namespace, name string, rv int64)
}

// entry is a stored object tagged with the resource version it was last written
// at, so Replace can tell a live write that outran the LIST snapshot from an
// object the snapshot authoritatively dropped.
type entry struct {
	obj runtime.Object
	rv  int64
}

// store is the in-memory Store implementation.
type store struct {
	mu    sync.Mutex
	items map[string]entry
	// tombstones records keys evicted by a live delete, keyed to the delete's
	// resource version, so a re-list whose snapshot predates the delete does not
	// resurrect the object. Entries are dropped once a snapshot at or past their
	// rv confirms the removal (see Replace).
	tombstones map[string]int64
}

var (
	_ Store = (*store)(nil)
	_ Cache = (*store)(nil)
)

// NewStore returns an empty Store, ready to be shared between an Informer (which
// refreshes it on each re-list) and a reader such as a getter (which reads it,
// and may write through fresh reads to keep it warm).
func NewStore() Store {
	return &store{items: map[string]entry{}, tombstones: map[string]int64{}}
}

// List returns a snapshot of the objects in the store. It returns an empty
// (non-nil) slice before the first Replace. The context is accepted for signature
// parity with API-backed readers; the read itself is in-memory.
func (s *store) List(_ context.Context) []runtime.Object {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]runtime.Object, 0, len(s.items))
	for _, e := range s.items {
		out = append(out, e.obj)
	}
	return out
}

// Update writes obj into the store, keyed by namespace/name and tagged with its
// resource version — the write-through used to keep the store warm between
// re-lists. A write at or past a tombstoned delete supersedes it: the object was
// re-created, so drop the tombstone.
func (s *store) Update(_ context.Context, obj runtime.Object) {
	key, err := cache.MetaNamespaceKeyFunc(obj)
	if err != nil {
		return
	}
	rv := objectResourceVersion(obj)
	s.mu.Lock()
	defer s.mu.Unlock()
	if trv, ok := s.tombstones[key]; ok {
		if rv < trv {
			// A newer delete supersedes this write; keep the object evicted.
			return
		}
		delete(s.tombstones, key) // this write is at or past the delete: re-created
	}
	s.items[key] = entry{obj: obj, rv: rv}
}

// Delete removes an object from the store, the write-through counterpart to
// Update for a reader that has just observed the object is gone (a NotFound). It
// records no tombstone: a reader cannot date the deletion, so it leaves the
// re-list reconciliation to DeleteAt, which the informer calls with the delete's
// resource version.
func (s *store) Delete(_ context.Context, namespace, name string) {
	s.deleteKey(keyFor(namespace, name), 0)
}

// DeleteAt removes an object and tombstones it at rv; see Store.
func (s *store) DeleteAt(_ context.Context, namespace, name string, rv int64) {
	s.deleteKey(keyFor(namespace, name), rv)
}

func (s *store) deleteKey(key string, rv int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, key)
	if rv > 0 {
		s.tombstones[key] = rv
	}
}

// Replace swaps the store's contents for objs and returns the add/update/remove
// diff against the previous snapshot, reconciled against live write-throughs that
// raced the LIST via listRV. See Store.Replace.
func (s *store) Replace(objs []runtime.Object, listRV int64) (added, updated, removed []runtime.Object) {
	next := make(map[string]entry, len(objs))
	for _, obj := range objs {
		if key, err := cache.MetaNamespaceKeyFunc(obj); err == nil {
			next[key] = entry{obj: obj, rv: objectResourceVersion(obj)}
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	prev := s.items
	prevTomb := s.tombstones

	// listRV dates the snapshot so we can reconcile it against live write-throughs
	// that raced the LIST. A non-positive listRV means the caller could not date
	// the snapshot (an older server, or unparseable list metadata); honor the
	// documented fallback and do a plain wholesale swap rather than compare against
	// it — every positive object/tombstone RV would otherwise read as newer than a
	// zero snapshot, so an authoritative list could never remove a deleted object
	// and tombstones would never expire.
	reconcile := listRV > 0

	// result is the snapshot we install: objs, minus resurrections we suppress,
	// plus live writes newer than the snapshot we carry forward.
	result := make(map[string]entry, len(next))
	for key, e := range next {
		result[key] = e
	}

	// Classify snapshot objects in objs order (not map order) so added/updated
	// are deterministic. A LIST carries no duplicate keys, but guard anyway.
	seen := make(map[string]struct{}, len(objs))
	for _, obj := range objs {
		key, err := cache.MetaNamespaceKeyFunc(obj)
		if err != nil {
			continue
		}
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		e := next[key]
		if _, ok := prev[key]; ok {
			updated = append(updated, e.obj)
			continue
		}
		// New to the snapshot. Suppress it when a live delete newer than the
		// snapshot already evicted it: the snapshot predates that delete, so
		// re-adding would resurrect a just-deleted object as a spurious add.
		if reconcile {
			if trv, ok := prevTomb[key]; ok && trv > listRV && e.rv < trv {
				delete(result, key)
				continue
			}
		}
		added = append(added, e.obj)
	}

	for key, e := range prev {
		if _, ok := next[key]; ok {
			continue
		}
		// Gone from the snapshot. A retained copy newer than listRV is a live
		// write that landed after the LIST read its snapshot, so the snapshot's
		// silence about it is stale — carry it forward instead of reporting a
		// spurious delete (and dropping a live-added object).
		if reconcile && e.rv > listRV {
			result[key] = e
			continue
		}
		removed = append(removed, e.obj)
	}

	// Keep tombstones the snapshot does not yet reflect (rv > listRV) and that no
	// present object supersedes; drop the rest, so a tombstone cannot suppress an
	// object forever once a snapshot postdating the delete confirms the removal. A
	// wholesale swap (no reconciliation) makes no dated claim, so it drops them all.
	newTomb := make(map[string]int64, len(prevTomb))
	if reconcile {
		for key, trv := range prevTomb {
			if trv <= listRV {
				continue
			}
			if _, present := result[key]; present {
				continue
			}
			newTomb[key] = trv
		}
	}

	s.items = result
	s.tombstones = newTomb
	return added, updated, removed
}

// Merge upserts objs into the store without removing keys absent from objs and
// returns the newly-added and re-observed (updated) objects; see Store.Merge. It
// mirrors Replace's per-key add/update classification and tombstone reconciliation
// for the objects it reads, but never diffs for removals and never expires
// tombstones — an unread key is not evidence the object is gone.
func (s *store) Merge(objs []runtime.Object, listRV int64) (added, updated []runtime.Object) {
	reconcile := listRV > 0
	s.mu.Lock()
	defer s.mu.Unlock()
	seen := make(map[string]struct{}, len(objs))
	for _, obj := range objs {
		key, err := cache.MetaNamespaceKeyFunc(obj)
		if err != nil {
			continue
		}
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		rv := objectResourceVersion(obj)
		if _, ok := s.items[key]; ok {
			s.items[key] = entry{obj: obj, rv: rv}
			updated = append(updated, obj)
			continue
		}
		// New to the snapshot. Suppress a resurrection: a live delete newer than
		// the snapshot already evicted this key, so re-adding from an older snapshot
		// would resurrect a just-deleted object as a spurious add.
		if reconcile {
			if trv, ok := s.tombstones[key]; ok && trv > listRV && rv < trv {
				continue
			}
		}
		// A re-observed object at or past a tombstoned delete supersedes it: the
		// object was re-created, so drop the tombstone.
		if trv, ok := s.tombstones[key]; ok && rv >= trv {
			delete(s.tombstones, key)
		}
		s.items[key] = entry{obj: obj, rv: rv}
		added = append(added, obj)
	}
	return added, updated
}

// keyFor builds the namespace/name store key, matching cache.MetaNamespaceKeyFunc
// for the cluster-scoped (empty namespace) and namespaced cases.
func keyFor(namespace, name string) string {
	if namespace == "" {
		return name
	}
	return namespace + "/" + name
}

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
// between re-lists (Update/Delete) by a caller that has just observed a fresh
// object. It is a staleness-tolerant view — never a source of truth for a read a
// reconcile depends on — meant for counts and other cheap, resync-cadence reads.
//
// The informer owns a Store (it refreshes it via Replace); a reader shares it as
// a Cache. Construct one with NewStore.
type Store interface {
	Cache
	// Replace swaps the store's contents for objs and reports the diff against the
	// previous snapshot: added is the objects whose key was not present before,
	// removed is the objects present before but absent now (carrying their
	// last-known state). The informer dispatches added as OnAdd — so add-only
	// handlers still wake for an object first seen by a re-list — and removed as
	// OnDelete for objects that have vanished since the previous re-list.
	Replace(objs []runtime.Object) (added, removed []runtime.Object)
}

// store is the in-memory Store implementation.
type store struct {
	mu    sync.Mutex
	items map[string]runtime.Object
}

var (
	_ Store = (*store)(nil)
	_ Cache = (*store)(nil)
)

// NewStore returns an empty Store, ready to be shared between an Informer (which
// refreshes it on each re-list) and a reader such as a getter (which reads it,
// and may write through fresh reads to keep it warm).
func NewStore() Store {
	return &store{items: map[string]runtime.Object{}}
}

// List returns a snapshot of the objects in the store. It returns an empty
// (non-nil) slice before the first Replace. The context is accepted for signature
// parity with API-backed readers; the read itself is in-memory.
func (s *store) List(_ context.Context) []runtime.Object {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]runtime.Object, 0, len(s.items))
	for _, obj := range s.items {
		out = append(out, obj)
	}
	return out
}

// Update writes obj into the store, keyed by namespace/name — the write-through
// used to keep the store warm between re-lists.
func (s *store) Update(_ context.Context, obj runtime.Object) {
	key, err := cache.MetaNamespaceKeyFunc(obj)
	if err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[key] = obj
}

// Delete removes an object from the store, the write-through counterpart to
// Update for a caller that has just observed the object is gone.
func (s *store) Delete(_ context.Context, namespace, name string) {
	key := name
	if namespace != "" {
		key = namespace + "/" + name
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, key)
}

// Replace swaps the store's contents for objs and returns the objects that were
// present before but are absent now, carrying their last-known state. The
// informer uses that set to emit deletes for objects that have vanished since the
// previous re-list.
func (s *store) Replace(objs []runtime.Object) (added, removed []runtime.Object) {
	next := make(map[string]runtime.Object, len(objs))
	for _, obj := range objs {
		if key, err := cache.MetaNamespaceKeyFunc(obj); err == nil {
			next[key] = obj
		}
	}

	s.mu.Lock()
	prev := s.items
	s.items = next
	s.mu.Unlock()

	for key, obj := range next {
		if _, ok := prev[key]; !ok {
			added = append(added, obj)
		}
	}
	for key, obj := range prev {
		if _, ok := next[key]; !ok {
			removed = append(removed, obj)
		}
	}
	return added, removed
}

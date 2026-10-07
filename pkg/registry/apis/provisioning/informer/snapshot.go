package informer

import (
	"context"
	"sync"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// RepositorySnapshot is the informer's snapshot with a running count of the
// active (not terminating) repositories in each namespace.
//
// The count exists because the quota check runs once per reconcile, and a
// reconcile runs for every repository on every tick. Counting by walking the
// snapshot made that quadratic: the snapshot is cluster-wide, so each of N
// reconciles allocated and scanned all N entries under the store's lock. Keeping
// the tallies here makes a quota check a map read.
//
// Every mutation passes through, so the tallies are derived from exactly the
// snapshot's own contents and answer what a scan would have. That includes the
// subtle one: a live MODIFIED is deliberately never written to the snapshot
// (it carries namespace and name only, so it would blank a real
// deletionTimestamp), so it cannot reach the tallies either.
type RepositorySnapshot struct {
	usinformer.Store

	mu     sync.RWMutex
	active map[string]bool // key -> not terminating
	counts map[string]int  // namespace -> active repositories
}

// NewRepositorySnapshot wraps store to tally active repositories per namespace.
func NewRepositorySnapshot(store usinformer.Store) *RepositorySnapshot {
	return &RepositorySnapshot{
		Store:  store,
		active: map[string]bool{},
		counts: map[string]int{},
	}
}

// CountActive reports the namespace's active repositories. It tolerates
// staleness to the same degree the snapshot does.
func (s *RepositorySnapshot) CountActive(namespace string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.counts[namespace]
}

func (s *RepositorySnapshot) Update(ctx context.Context, obj runtime.Object) {
	s.Store.Update(ctx, obj)

	namespace, name, terminating, ok := repositoryState(obj)
	if !ok {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.set(repositoryKey(namespace, name), namespace, !terminating)
}

func (s *RepositorySnapshot) Delete(ctx context.Context, namespace, name string) {
	s.Store.Delete(ctx, namespace, name)
	s.drop(repositoryKey(namespace, name), namespace)
}

func (s *RepositorySnapshot) DeleteAt(ctx context.Context, namespace, name string, rv int64) {
	s.Store.DeleteAt(ctx, namespace, name, rv)
	s.drop(repositoryKey(namespace, name), namespace)
}

// Replace rebuilds the tallies from what the store installed rather than from
// objs: Replace carries forward a live write the snapshot predates and suppresses
// a resurrection the snapshot would have re-added, so objs is not what ends up
// stored. One pass per re-list, against one per reconcile before.
func (s *RepositorySnapshot) Replace(objs []runtime.Object, listRV int64) (added, updated, removed []runtime.Object) {
	added, updated, removed = s.Store.Replace(objs, listRV)

	stored := s.Store.List(context.Background())
	active := make(map[string]bool, len(stored))
	counts := make(map[string]int, len(s.counts))
	for _, obj := range stored {
		namespace, name, terminating, ok := repositoryState(obj)
		if !ok {
			continue
		}
		active[repositoryKey(namespace, name)] = !terminating
		if !terminating {
			counts[namespace]++
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.active, s.counts = active, counts
	return added, updated, removed
}

// set records whether a key is active, adjusting its namespace tally by the
// change. Callers hold the lock.
func (s *RepositorySnapshot) set(key, namespace string, isActive bool) {
	was, known := s.active[key]
	s.active[key] = isActive
	switch {
	case isActive && (!known || !was):
		s.counts[namespace]++
	case !isActive && known && was:
		s.decrement(namespace)
	}
}

func (s *RepositorySnapshot) drop(key, namespace string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if was, known := s.active[key]; known {
		delete(s.active, key)
		if was {
			s.decrement(namespace)
		}
	}
}

// decrement keeps empty namespaces out of the map, so a cluster-wide snapshot
// does not accumulate an entry per namespace that ever held a repository.
func (s *RepositorySnapshot) decrement(namespace string) {
	if s.counts[namespace] <= 1 {
		delete(s.counts, namespace)
		return
	}
	s.counts[namespace]--
}

// repositoryState reads the identity and deletion state the tallies need. It
// goes through meta.Accessor rather than a type assertion so the snapshot can
// hold any projection of a repository.
func repositoryState(obj runtime.Object) (namespace, name string, terminating, ok bool) {
	acc, err := meta.Accessor(obj)
	if err != nil {
		return "", "", false, false
	}
	return acc.GetNamespace(), acc.GetName(), acc.GetDeletionTimestamp() != nil, true
}

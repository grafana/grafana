package informer

import (
	"context"
	"sync"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"

	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// RepositorySnapshot is the informer's snapshot with a running count of the
// active (not terminating) repositories per namespace, so the quota check reads
// a number instead of walking the snapshot on every reconcile.
//
// Every mutation holds mu across the store write and the tally update, so a live
// event landing mid-re-list is not overwritten by a rebuild that predates it. The
// tallies only move for writes the store reports it took.
type RepositorySnapshot struct {
	store usinformer.Store

	// mu also serializes store mutations with the tally update; the store's own
	// lock cannot cover both.
	mu     sync.RWMutex
	active map[string]bool // key -> not terminating
	counts map[string]int  // namespace -> active repositories
}

// NewRepositorySnapshot wraps store to tally active repositories per namespace.
func NewRepositorySnapshot(store usinformer.Store) *RepositorySnapshot {
	return &RepositorySnapshot{
		store:  store,
		active: map[string]bool{},
		counts: map[string]int{},
	}
}

// CountActive reports the namespace's active repositories.
func (s *RepositorySnapshot) CountActive(namespace string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.counts[namespace]
}

func (s *RepositorySnapshot) List(ctx context.Context) []runtime.Object {
	return s.store.List(ctx)
}

// Update writes through and tallies only what the store took; counting a write a
// newer delete supersedes would resurrect a deleted repository into the quota.
func (s *RepositorySnapshot) Update(ctx context.Context, obj runtime.Object) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.store.Update(ctx, obj) {
		return false
	}

	namespace, name, terminating, ok := repositoryState(obj)
	if !ok {
		return true
	}
	s.set(repositoryKey(namespace, name), namespace, !terminating)
	return true
}

func (s *RepositorySnapshot) Delete(ctx context.Context, namespace, name string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.store.Delete(ctx, namespace, name)
	s.drop(repositoryKey(namespace, name), namespace)
}

func (s *RepositorySnapshot) DeleteAt(ctx context.Context, namespace, name string, rv int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.store.DeleteAt(ctx, namespace, name, rv)
	s.drop(repositoryKey(namespace, name), namespace)
}

// Replace rebuilds the tallies from what the store installed, not from objs,
// which the store may adjust for live writes that raced the list.
func (s *RepositorySnapshot) Replace(objs []runtime.Object, listRV int64) (added, updated, removed []runtime.Object) {
	s.mu.Lock()
	defer s.mu.Unlock()

	added, updated, removed = s.store.Replace(objs, listRV)

	stored := s.store.List(context.Background())
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
	s.active, s.counts = active, counts

	return added, updated, removed
}

// set records whether a key is active. Callers hold the lock.
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

// drop forgets a key. Callers hold the lock.
func (s *RepositorySnapshot) drop(key, namespace string) {
	if was, known := s.active[key]; known {
		delete(s.active, key)
		if was {
			s.decrement(namespace)
		}
	}
}

// decrement prunes empty namespaces. Callers hold the lock.
func (s *RepositorySnapshot) decrement(namespace string) {
	if s.counts[namespace] <= 1 {
		delete(s.counts, namespace)
		return
	}
	s.counts[namespace]--
}

// repositoryState reads what the tallies need through meta.Accessor, so any
// projection of a repository works.
func repositoryState(obj runtime.Object) (namespace, name string, terminating, ok bool) {
	acc, err := meta.Accessor(obj)
	if err != nil {
		return "", "", false, false
	}
	return acc.GetNamespace(), acc.GetName(), acc.GetDeletionTimestamp() != nil, true
}

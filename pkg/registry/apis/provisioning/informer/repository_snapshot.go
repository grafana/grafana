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
// a number instead of walking a cluster-wide snapshot on every reconcile.
//
// Every mutation passes through, so the tallies see exactly what the snapshot
// holds. A live MODIFIED never reaches the store (it carries namespace and name
// only, so it would blank a real deletionTimestamp) and so never reaches these
// either.
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

// CountActive reports the namespace's active repositories, as stale as the
// snapshot itself.
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

// Replace rebuilds the tallies from what the store installed, not from objs: it
// carries forward a live write the snapshot predates and suppresses a
// resurrection, so objs is not what ends up stored.
func (s *RepositorySnapshot) Replace(objs []runtime.Object, listRV int64) (added, updated, removed []runtime.Object) {
	added, updated, removed = s.Store.Replace(objs, listRV)

	// The embedded store's List, not the promoted one: a List override added here
	// later must not silently redirect this read.
	//nolint:staticcheck // QF1008: the qualifier is the point.
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

// decrement prunes empty namespaces, so a cluster-wide snapshot does not retain
// an entry per namespace that ever held a repository.
func (s *RepositorySnapshot) decrement(namespace string) {
	if s.counts[namespace] <= 1 {
		delete(s.counts, namespace)
		return
	}
	s.counts[namespace]--
}

// repositoryState reads what the tallies need, through meta.Accessor rather than
// a type assertion so the snapshot can hold any projection of a repository.
func repositoryState(obj runtime.Object) (namespace, name string, terminating, ok bool) {
	acc, err := meta.Accessor(obj)
	if err != nil {
		return "", "", false, false
	}
	return acc.GetNamespace(), acc.GetName(), acc.GetDeletionTimestamp() != nil, true
}

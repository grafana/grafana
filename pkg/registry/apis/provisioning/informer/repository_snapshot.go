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
// Correctness rests on two things. Every mutation holds mu across both the
// store write and the tally update, so a live event landing mid-re-list cannot
// have its tally change overwritten by a rebuild that predates it. And the
// tallies only move for writes the store accepted: Update is silently dropped
// when a newer delete has tombstoned the key, and counting a dropped write would
// leave a deleted repository holding quota.
//
// A live MODIFIED never reaches the store at all (it carries namespace and name
// only, so it would blank a real deletionTimestamp) and so never reaches these
// either.
type RepositorySnapshot struct {
	store usinformer.Store

	// mu serializes store mutations with tally maintenance. It is not only
	// guarding the maps: the store has its own lock, but two callers
	// interleaving between a store write and the matching tally update would
	// still leave the two disagreeing.
	mu     sync.RWMutex
	active map[string]bool  // key -> not terminating
	counts map[string]int   // namespace -> active repositories
	tombs  map[string]int64 // key -> resource version of a delete the store still honours
}

// NewRepositorySnapshot wraps store to tally active repositories per namespace.
func NewRepositorySnapshot(store usinformer.Store) *RepositorySnapshot {
	return &RepositorySnapshot{
		store:  store,
		active: map[string]bool{},
		counts: map[string]int{},
		tombs:  map[string]int64{},
	}
}

// CountActive reports the namespace's active repositories, as stale as the
// snapshot itself.
func (s *RepositorySnapshot) CountActive(namespace string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.counts[namespace]
}

func (s *RepositorySnapshot) List(ctx context.Context) []runtime.Object {
	return s.store.List(ctx)
}

// Update writes through and tallies the result, skipping the tally when the
// store will drop the write. The store drops an Update whose resource version
// predates a delete it has tombstoned, which is what a reconcile read that
// finished after a live deletion looks like: counting it would resurrect a
// deleted repository into the quota.
func (s *RepositorySnapshot) Update(ctx context.Context, obj runtime.Object) {
	namespace, name, terminating, ok := repositoryState(obj)
	if !ok {
		s.store.Update(ctx, obj)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.store.Update(ctx, obj)

	key := repositoryKey(namespace, name)
	if trv, tombstoned := s.tombs[key]; tombstoned {
		if objectRV(obj) < trv {
			return // superseded by a newer delete; the store kept the object evicted
		}
		delete(s.tombs, key) // at or past the delete: re-created, and the store took it
	}
	s.set(key, namespace, !terminating)
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

	key := repositoryKey(namespace, name)
	s.drop(key, namespace)
	if rv > 0 {
		// Mirrors the tombstone the store just recorded, so a stale Update that
		// the store will drop is not tallied. Replace prunes these the way the
		// store prunes its own.
		s.tombs[key] = rv
	}
}

// Replace rebuilds the tallies from what the store installed, not from objs: it
// carries forward a live write the snapshot predates and suppresses a
// resurrection, so objs is not what ends up stored.
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

	// Prune the mirrored tombstones on the store's rule: a delete the snapshot
	// now reflects is spent, and anything the snapshot re-added is a re-creation
	// the store already accepted. A snapshot the caller could not date makes no
	// claim about when it was read, so the store drops every tombstone and the
	// mirror must too -- keeping them would reject writes the store now accepts,
	// and would leak an entry per delete for as long as lists stay undated.
	if listRV <= 0 {
		clear(s.tombs)
		return added, updated, removed
	}
	for key, trv := range s.tombs {
		if trv <= listRV {
			delete(s.tombs, key)
			continue
		}
		if _, present := active[key]; present {
			delete(s.tombs, key)
		}
	}

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

// decrement prunes empty namespaces, so a cluster-wide snapshot does not retain
// an entry per namespace that ever held a repository. Callers hold the lock.
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

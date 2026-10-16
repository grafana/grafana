package informer

import (
	"strconv"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// scanActive is the count the quota check used to compute: a walk of the whole
// snapshot. The tallies must agree with it after any sequence of mutations.
func scanActive(t *testing.T, store usinformer.Store, namespace string) int {
	t.Helper()
	count := 0
	for _, obj := range store.List(t.Context()) {
		ns, _, terminating, ok := repositoryState(obj)
		if ok && ns == namespace && !terminating {
			count++
		}
	}
	return count
}

func objs(repos ...*provisioningapis.Repository) []runtime.Object {
	out := make([]runtime.Object, 0, len(repos))
	for _, repo := range repos {
		out = append(out, repo)
	}
	return out
}

// requireAgrees pins the tallies to a scan of the same snapshot, for every
// namespace mentioned.
func requireAgrees(t *testing.T, snapshot *RepositorySnapshot, namespaces ...string) {
	t.Helper()
	for _, ns := range namespaces {
		require.Equal(t, scanActive(t, snapshot, ns), snapshot.CountActive(ns),
			"tally and scan disagree for namespace %q", ns)
	}
}

func TestRepositorySnapshot_CountsPerNamespace(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(
		repoAt("ns-a", "one", "1"), repoAt("ns-a", "two", "1"),
		terminating(repoAt("ns-a", "going", "1")),
		repoAt("ns-b", "other", "1"),
	), 10)

	assert.Equal(t, 2, snapshot.CountActive("ns-a"), "the terminating one is not active")
	assert.Equal(t, 1, snapshot.CountActive("ns-b"))
	assert.Zero(t, snapshot.CountActive("ns-none"))
	requireAgrees(t, snapshot, "ns-a", "ns-b", "ns-none")
}

// A reconcile write-back is how a soft delete reaches the count before the next
// re-list.
func TestRepositorySnapshot_WriteThroughMovesTheCount(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(repoAt("ns", "going", "1"), repoAt("ns", "staying", "1")), 10)
	require.Equal(t, 2, snapshot.CountActive("ns"))

	snapshot.Update(t.Context(), terminating(repoAt("ns", "going", "2")))
	assert.Equal(t, 1, snapshot.CountActive("ns"), "a terminating repository leaves the count")
	requireAgrees(t, snapshot, "ns")

	// Idempotent: the same object seen twice must not double-count.
	snapshot.Update(t.Context(), terminating(repoAt("ns", "going", "2")))
	assert.Equal(t, 1, snapshot.CountActive("ns"))

	// And it can come back, which is what a recreate looks like.
	snapshot.Update(t.Context(), repoAt("ns", "going", "3"))
	assert.Equal(t, 2, snapshot.CountActive("ns"))
	requireAgrees(t, snapshot, "ns")
}

func TestRepositorySnapshot_DeletesLeaveTheCount(t *testing.T) {
	for _, tc := range []struct {
		name   string
		delete func(s *RepositorySnapshot)
	}{
		{"reader eviction", func(s *RepositorySnapshot) { s.Delete(t.Context(), "ns", "gone") }},
		{"live delete", func(s *RepositorySnapshot) { s.DeleteAt(t.Context(), "ns", "gone", 99) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			snapshot := NewRepositorySnapshot(usinformer.NewStore())
			snapshot.Replace(objs(repoAt("ns", "gone", "1"), repoAt("ns", "kept", "1")), 10)
			require.Equal(t, 2, snapshot.CountActive("ns"))

			tc.delete(snapshot)
			assert.Equal(t, 1, snapshot.CountActive("ns"))
			requireAgrees(t, snapshot, "ns")

			// Twice must not take the count below the truth.
			tc.delete(snapshot)
			assert.Equal(t, 1, snapshot.CountActive("ns"))
		})
	}
}

// Replace rebuilds rather than accumulates: a re-list that drops a repository
// drops it from the count.
func TestRepositorySnapshot_ReplaceRebuilds(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(repoAt("ns", "a", "1"), repoAt("ns", "b", "1"), repoAt("other", "c", "1")), 10)
	require.Equal(t, 2, snapshot.CountActive("ns"))

	snapshot.Replace(objs(repoAt("ns", "a", "2")), 20)
	assert.Equal(t, 1, snapshot.CountActive("ns"), "b is gone from the snapshot and from the count")
	assert.Zero(t, snapshot.CountActive("other"), "a namespace the re-list no longer mentions")
	requireAgrees(t, snapshot, "ns", "other")
}

// The tallies come from what the store installed, which carries forward live
// writes newer than the snapshot.
func TestRepositorySnapshot_ReplaceCountsWhatTheStoreKept(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	// A live add at rv 30, then a re-list read at rv 20: the store keeps the newer
	// object.
	snapshot.Update(t.Context(), repoAt("ns", "live", "30"))
	snapshot.Replace(objs(repoAt("ns", "listed", "15")), 20)

	assert.Equal(t, 2, snapshot.CountActive("ns"), "the carried-forward live add still counts")
	requireAgrees(t, snapshot, "ns")
}

// A namespace that empties leaves no entry behind.
func TestRepositorySnapshot_PrunesEmptyNamespaces(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(repoAt("ns", "only", "1")), 10)
	snapshot.Delete(t.Context(), "ns", "only")

	assert.Zero(t, snapshot.CountActive("ns"))
	snapshot.mu.RLock()
	defer snapshot.mu.RUnlock()
	assert.Empty(t, snapshot.counts, "an emptied namespace must not be retained")
}

// A write the store drops (older than a tombstoned delete) must not be tallied,
// or a deleted repository holds quota.
func TestRepositorySnapshot_IgnoresWritesTheStoreDrops(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(repoAt("ns", "going", "10")), 5)
	require.Equal(t, 1, snapshot.CountActive("ns"))

	// Live delete at 20, then a reconcile read that was issued before it lands.
	snapshot.DeleteAt(t.Context(), "ns", "going", 20)
	snapshot.Update(t.Context(), repoAt("ns", "going", "10"))

	assert.Zero(t, snapshot.CountActive("ns"), "the store kept it evicted, so it must not be counted")
	requireAgrees(t, snapshot, "ns")
}

// A write at or past the delete is a re-creation, which the store does accept.
func TestRepositorySnapshot_CountsWritesPastTheDelete(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(repoAt("ns", "going", "10")), 5)
	snapshot.DeleteAt(t.Context(), "ns", "going", 20)
	require.Zero(t, snapshot.CountActive("ns"))

	snapshot.Update(t.Context(), repoAt("ns", "going", "30"))

	assert.Equal(t, 1, snapshot.CountActive("ns"), "a re-creation the store took must be counted")
	requireAgrees(t, snapshot, "ns")
}

// A re-list past the delete spends the tombstone, so later writes are ordinary
// again.
func TestRepositorySnapshot_ReplaceSpendsTheTombstone(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.DeleteAt(t.Context(), "ns", "going", 20)
	snapshot.Replace(nil, 25) // snapshot read after the delete: the store drops the tombstone

	snapshot.Update(t.Context(), repoAt("ns", "going", "10"))

	assert.Equal(t, 1, snapshot.CountActive("ns"), "no tombstone left to supersede the write")
	requireAgrees(t, snapshot, "ns")
}

// A mutation landing mid re-list must not have its tally overwritten by the
// rebuild.
func TestRepositorySnapshot_ConcurrentMutationsAgreeWithTheStore(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())

	const repos = 40
	seed := make([]*provisioningapis.Repository, 0, repos)
	for i := range repos {
		seed = append(seed, repoAt("ns", "r"+strconv.Itoa(i), "10"))
	}
	snapshot.Replace(objs(seed...), 10)

	var wg sync.WaitGroup
	for i := range repos {
		wg.Add(1)
		go func() {
			defer wg.Done()
			name := "r" + strconv.Itoa(i)
			switch i % 3 {
			case 0:
				snapshot.DeleteAt(t.Context(), "ns", name, 30)
			case 1:
				snapshot.Update(t.Context(), terminating(repoAt("ns", name, "30")))
			default:
				snapshot.Update(t.Context(), repoAt("ns", name, "30"))
			}
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		snapshot.Replace(objs(seed...), 20)
	}()
	wg.Wait()

	// Whatever order they landed in, the tally has to describe the snapshot.
	requireAgrees(t, snapshot, "ns")
}

// An undated snapshot (listRV 0) drops every tombstone in the store, so the
// tallies must follow and accept the writes the store now accepts.
func TestRepositorySnapshot_UndatedReplaceClearsTheTombstones(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.DeleteAt(t.Context(), "ns", "going", 20)
	snapshot.Replace(nil, 0)

	snapshot.Update(t.Context(), repoAt("ns", "going", "10"))

	assert.Equal(t, 1, snapshot.CountActive("ns"), "the store took the write, so it must be counted")
	requireAgrees(t, snapshot, "ns")
}

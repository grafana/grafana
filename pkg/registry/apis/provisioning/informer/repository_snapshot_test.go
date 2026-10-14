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

// scanActive is the count the quota check used to compute for itself, by walking
// the whole cluster-wide snapshot on every reconcile. The tallies have to agree
// with it after any sequence of mutations, or the cheaper count is a wrong one.
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

// A reconcile reads the repository fresh and writes it back, which is how a soft
// delete reaches the count before the next re-list.
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

// Replace is authoritative, so it has to rebuild rather than accumulate: a
// re-list that drops a repository must drop it from the count too.
func TestRepositorySnapshot_ReplaceRebuilds(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(repoAt("ns", "a", "1"), repoAt("ns", "b", "1"), repoAt("other", "c", "1")), 10)
	require.Equal(t, 2, snapshot.CountActive("ns"))

	snapshot.Replace(objs(repoAt("ns", "a", "2")), 20)
	assert.Equal(t, 1, snapshot.CountActive("ns"), "b is gone from the snapshot and from the count")
	assert.Zero(t, snapshot.CountActive("other"), "a namespace the re-list no longer mentions")
	requireAgrees(t, snapshot, "ns", "other")
}

// Replace carries forward a live write newer than the snapshot it is given, so
// the tallies must come from what the store installed and not from the argument.
func TestRepositorySnapshot_ReplaceCountsWhatTheStoreKept(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	// A live add at rv 30, then a re-list whose snapshot was read at rv 20: the
	// store keeps the newer object, so the count must include it.
	snapshot.Update(t.Context(), repoAt("ns", "live", "30"))
	snapshot.Replace(objs(repoAt("ns", "listed", "15")), 20)

	assert.Equal(t, 2, snapshot.CountActive("ns"), "the carried-forward live add still counts")
	requireAgrees(t, snapshot, "ns")
}

// The snapshot is cluster-wide, so a namespace that empties must not leave an
// entry behind: one per namespace that ever held a repository is a leak.
func TestRepositorySnapshot_PrunesEmptyNamespaces(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.Replace(objs(repoAt("ns", "only", "1")), 10)
	snapshot.Delete(t.Context(), "ns", "only")

	assert.Zero(t, snapshot.CountActive("ns"))
	snapshot.mu.RLock()
	defer snapshot.mu.RUnlock()
	assert.Empty(t, snapshot.counts, "an emptied namespace must not be retained")
}

// The store drops an Update whose resource version predates a delete it has
// tombstoned, which is what a reconcile read that finished after a live deletion
// looks like. Tallying it anyway would leave a deleted repository holding quota.
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

// A re-list whose snapshot postdates the delete spends the tombstone, so a write
// after it is an ordinary one again rather than a stale one.
func TestRepositorySnapshot_ReplaceSpendsTheTombstone(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.DeleteAt(t.Context(), "ns", "going", 20)
	snapshot.Replace(nil, 25) // snapshot read after the delete: the store drops the tombstone

	snapshot.Update(t.Context(), repoAt("ns", "going", "10"))

	assert.Equal(t, 1, snapshot.CountActive("ns"), "no tombstone left to supersede the write")
	requireAgrees(t, snapshot, "ns")
}

// A mutation landing while a re-list is in flight must not have its tally change
// overwritten by the rebuild: both run under the same lock, so the rebuild either
// precedes the mutation or observes it.
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

// listAllPages returns 0 when it cannot read the snapshot's resource version,
// and the store responds by dropping every tombstone: an undated snapshot makes
// no claim about when it was read, so it cannot be used to arbitrate a delete.
// The mirror has to drop them too, or it rejects writes the store now accepts
// and leaks an entry per delete for as long as lists stay undated.
func TestRepositorySnapshot_UndatedReplaceClearsTheTombstones(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())
	snapshot.DeleteAt(t.Context(), "ns", "going", 20)
	snapshot.Replace(nil, 0)

	snapshot.Update(t.Context(), repoAt("ns", "going", "10"))

	assert.Equal(t, 1, snapshot.CountActive("ns"), "the store took the write, so it must be counted")
	requireAgrees(t, snapshot, "ns")

	snapshot.mu.RLock()
	defer snapshot.mu.RUnlock()
	assert.Empty(t, snapshot.tombs, "an undated snapshot must leave no mirrored tombstones")
}

// Deletes arriving while lists stay undated must not pile up in the mirror.
func TestRepositorySnapshot_UndatedReplacesDoNotAccumulateTombstones(t *testing.T) {
	snapshot := NewRepositorySnapshot(usinformer.NewStore())

	for i := range 50 {
		snapshot.DeleteAt(t.Context(), "ns", "r"+strconv.Itoa(i), int64(20+i))
		snapshot.Replace(nil, 0)
	}

	snapshot.mu.RLock()
	defer snapshot.mu.RUnlock()
	assert.Empty(t, snapshot.tombs, "the mirror must not grow while snapshots stay undated")
}

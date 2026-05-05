package search

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/oklog/ulid/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"
	"gocloud.dev/blob/memblob"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Default retention values used by the pure tests below. Tests that need a
// different threshold (e.g. rule-A age cutoff) inline their own.
const (
	testCleanupMaxAge = 7 * 24 * time.Hour
	testCleanupGrace  = 30 * time.Minute
)

// --- selectSnapshotsToDelete (pure retention rules) ---
//
// These tests cover retention semantics in isolation, without involving any
// bucket or lock backend. selectSnapshotsToDelete deliberately takes a clock
// and is pure, so the whole policy is exercisable as a unit.

func mkMeta(version string, rv int64, uploadedAt time.Time) *IndexMeta {
	return &IndexMeta{
		GrafanaBuildVersion:   version,
		LatestResourceVersion: rv,
		UploadTimestamp:       uploadedAt,
	}
}

// newCleanupTestBucket returns an in-memory bucket and a store backed by it,
// with the bucket's Close registered as test cleanup. Used by the end-to-end
// runCleanup tests.
func newCleanupTestBucket(t *testing.T) (*blob.Bucket, *BucketRemoteIndexStore) {
	t.Helper()
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })
	return bucket, newTestRemoteIndexStore(t, bucket)
}

func TestSelectSnapshotsToDelete_AgeCutoff(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)

	old := makeULID(t, now.Add(-10*24*time.Hour))
	mid := makeULID(t, now.Add(-3*24*time.Hour))
	fresh := makeULID(t, now.Add(-time.Hour))

	metas := map[ulid.ULID]*IndexMeta{
		old:   mkMeta("11.5.0", 100, now.Add(-10*24*time.Hour)),
		mid:   mkMeta("11.5.0", 200, now.Add(-3*24*time.Hour)),
		fresh: mkMeta("11.5.0", 300, now.Add(-time.Hour)),
	}

	got := selectSnapshotsToDelete(metas, now, testCleanupMaxAge, testCleanupGrace)
	// Expect: old deleted by rule A; mid deleted by rule B (fresh is the newest
	// and stable beyond grace); fresh kept (newest in group).
	assert.ElementsMatch(t, []ulid.ULID{old, mid}, got)
}

func TestSelectSnapshotsToDelete_NewestInGroupAlwaysKept(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)

	keys := make([]ulid.ULID, 5)
	metas := map[ulid.ULID]*IndexMeta{}
	for i := range keys {
		keys[i] = makeULID(t, now.Add(-time.Duration(i)*time.Minute))
		metas[keys[i]] = mkMeta("11.5.0", int64(100+i*10), now.Add(-time.Duration(i+60)*time.Minute))
	}
	// Make the highest-RV (i=4 -> rv=140) the oldest by upload time, well past
	// grace. RV-desc beats UploadTimestamp-desc in the per-group sort, so this
	// snapshot still wins as the per-group keep.
	metas[keys[4]].UploadTimestamp = now.Add(-2 * time.Hour)

	got := selectSnapshotsToDelete(metas, now, testCleanupMaxAge, testCleanupGrace)
	// All except keys[4] must be deleted.
	assert.NotContains(t, got, keys[4])
	assert.Len(t, got, 4)
}

func TestSelectSnapshotsToDelete_OlderKeptWhileSuccessorStabilising(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)

	s1 := makeULID(t, now.Add(-2*time.Hour))
	s2 := makeULID(t, now.Add(-time.Minute))

	metas := map[ulid.ULID]*IndexMeta{
		s1: mkMeta("11.5.0", 100, now.Add(-2*time.Hour)),
		s2: mkMeta("11.5.0", 200, now.Add(-time.Minute)),
	}

	got := selectSnapshotsToDelete(metas, now, testCleanupMaxAge, testCleanupGrace)
	assert.Empty(t, got, "successor still inside grace window — predecessor must be retained")
}

func TestSelectSnapshotsToDelete_OlderDeletedOnceSuccessorStabilises(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)

	s1 := makeULID(t, now.Add(-2*time.Hour))
	s2 := makeULID(t, now.Add(-testCleanupGrace-time.Minute))

	metas := map[ulid.ULID]*IndexMeta{
		s1: mkMeta("11.5.0", 100, now.Add(-2*time.Hour)),
		s2: mkMeta("11.5.0", 200, now.Add(-testCleanupGrace-time.Minute)),
	}

	got := selectSnapshotsToDelete(metas, now, testCleanupMaxAge, testCleanupGrace)
	assert.Equal(t, []ulid.ULID{s1}, got)
}

func TestSelectSnapshotsToDelete_RuleAWinsOnLoneOldSnapshot(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)
	maxAge := 24 * time.Hour

	only := makeULID(t, now.Add(-2*maxAge))
	metas := map[ulid.ULID]*IndexMeta{
		only: mkMeta("11.5.0", 100, now.Add(-2*maxAge)),
	}

	got := selectSnapshotsToDelete(metas, now, maxAge, testCleanupGrace)
	assert.Equal(t, []ulid.ULID{only}, got)
}

func TestSelectSnapshotsToDelete_PerVersionIsolation(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)

	old15 := makeULID(t, now.Add(-3*time.Hour))
	new15 := makeULID(t, now.Add(-2*time.Hour))
	old16 := makeULID(t, now.Add(-3*time.Hour))
	new16 := makeULID(t, now.Add(-2*time.Hour))

	metas := map[ulid.ULID]*IndexMeta{
		old15: mkMeta("11.5.0", 100, now.Add(-3*time.Hour)),
		new15: mkMeta("11.5.0", 200, now.Add(-2*time.Hour)),
		old16: mkMeta("11.6.0", 100, now.Add(-3*time.Hour)),
		new16: mkMeta("11.6.0", 200, now.Add(-2*time.Hour)),
	}

	got := selectSnapshotsToDelete(metas, now, testCleanupMaxAge, testCleanupGrace)
	// One predecessor per group is deletable; both newest are kept.
	assert.ElementsMatch(t, []ulid.ULID{old15, old16}, got)
}

func TestSelectSnapshotsToDelete_UnparseableVersionLeftAlone(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)

	garbage := makeULID(t, now.Add(-time.Hour))
	metas := map[ulid.ULID]*IndexMeta{
		garbage: mkMeta("garbage", 100, now.Add(-time.Hour)),
	}

	got := selectSnapshotsToDelete(metas, now, testCleanupMaxAge, testCleanupGrace)
	assert.Empty(t, got, "unparseable version must be skipped, not deleted by rule B")
}

// TestSelectSnapshotsToDelete_NeverDeletesDownloadPick pins the cross-package
// invariant that cleanup must never delete a snapshot the download path would
// prefer. selectSnapshotsToDelete and pickBestSnapshot have independent sort
// orders today (cleanup: per-group RV desc, upload desc; download:
// tier-asc/version-desc/RV-desc/upload-desc) and a future change to either
// could make them disagree. This test runs both over the same input across a
// few representative shapes and asserts the picked snapshot is always in the
// keep set.
//
// We considered factoring the shared within-version-group comparator into a
// single helper called from both sites, which would make the invariant
// structurally true and let this test go away. We deferred that: the only
// genuinely shared logic is a five-line comparator, and the rest of each
// function (tier classification on the download side, grouping + grace-period
// rule on the cleanup side) is intentionally distinct. The shared helper
// would be small enough that the indirection costs more than it saves, while
// this test catches the same drift directly. Revisit if more selection logic
// ends up duplicated.
func TestSelectSnapshotsToDelete_NeverDeletesDownloadPick(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)
	minV := semver.MustParse("11.0.0")
	running := semver.MustParse("11.5.0")

	cases := map[string]map[ulid.ULID]*IndexMeta{
		"single version, multiple RVs": {
			makeULID(t, now.Add(-3*time.Hour)): mkMeta("11.5.0", 100, now.Add(-3*time.Hour)),
			makeULID(t, now.Add(-2*time.Hour)): mkMeta("11.5.0", 200, now.Add(-2*time.Hour)),
			makeULID(t, now.Add(-time.Hour)):   mkMeta("11.5.0", 150, now.Add(-time.Hour)),
		},
		"single version, RV ties broken by upload time": {
			makeULID(t, now.Add(-3*time.Hour)): mkMeta("11.5.0", 200, now.Add(-3*time.Hour)),
			makeULID(t, now.Add(-2*time.Hour)): mkMeta("11.5.0", 200, now.Add(-2*time.Hour)),
		},
		"two version groups, both stable, both tier 0": {
			makeULID(t, now.Add(-3*time.Hour)): mkMeta("11.4.0", 200, now.Add(-3*time.Hour)),
			makeULID(t, now.Add(-2*time.Hour)): mkMeta("11.4.0", 100, now.Add(-2*time.Hour)),
			makeULID(t, now.Add(-time.Hour)):   mkMeta("11.5.0", 100, now.Add(-time.Hour)),
		},
		"mixed tiers: tier 2 newer than running, tier 0 stable": {
			makeULID(t, now.Add(-3*time.Hour)): mkMeta("11.5.0", 200, now.Add(-3*time.Hour)),
			makeULID(t, now.Add(-2*time.Hour)): mkMeta("11.5.0", 100, now.Add(-2*time.Hour)),
			makeULID(t, now.Add(-time.Hour)):   mkMeta("11.6.0", 300, now.Add(-time.Hour)),
		},
		"successor still inside grace window": {
			makeULID(t, now.Add(-3*time.Hour)):   mkMeta("11.5.0", 100, now.Add(-3*time.Hour)),
			makeULID(t, now.Add(-5*time.Minute)): mkMeta("11.5.0", 200, now.Add(-5*time.Minute)),
		},
		"some snapshots dropped by age": {
			makeULID(t, now.Add(-30*24*time.Hour)): mkMeta("11.5.0", 50, now.Add(-30*24*time.Hour)),
			makeULID(t, now.Add(-2*time.Hour)):     mkMeta("11.5.0", 200, now.Add(-2*time.Hour)),
			makeULID(t, now.Add(-time.Hour)):       mkMeta("11.5.0", 150, now.Add(-time.Hour)),
		},
	}

	for name, metas := range cases {
		t.Run(name, func(t *testing.T) {
			be := &bleveBackend{
				log: log.New("cleanup-vs-download-test"),
				opts: BleveOptions{Snapshot: SnapshotOptions{
					MaxIndexAge:     testCleanupMaxAge,
					MinBuildVersion: minV,
				}},
				runningBuildVersion: running,
			}
			picked, ok := be.pickBestSnapshot(metas, now)
			require.Truef(t, ok, "test case must yield a pickable snapshot — if a no-pick scenario is needed, add a dedicated test case rather than letting this one short-circuit")

			deleted := selectSnapshotsToDelete(metas, now, testCleanupMaxAge, testCleanupGrace)
			for _, k := range deleted {
				assert.NotEqualf(t, picked.key, k,
					"cleanup deleted snapshot %s but download would pick it (version=%s rv=%d uploaded=%s)",
					k, picked.version, picked.meta.LatestResourceVersion, picked.meta.UploadTimestamp)
			}
		})
	}
}

// TestRunCleanup_ReplicaVersionAgnostic verifies that cleanup decisions do not
// depend on the running Grafana build version of the replica that runs them.
// A v11.5.0 replica and a v11.6.0 replica must produce the same delete set
// over the same input — each applies the same per-version-group rules to
// every group, rather than the download-side tier preference that would
// otherwise skew a v11.5.0 replica toward deleting v11.6.0 snapshots (or vice
// versa).
//
// The test drives the full runCleanup path (which reads b.runningBuildVersion
// indirectly through the snapshot wiring) instead of calling
// selectSnapshotsToDelete directly since it takes no version
// parameter; the regression we want to catch is "someone introduces
// tier logic into the cleanup path", which only the end-to-end form notices.
func TestRunCleanup_ReplicaVersionAgnostic(t *testing.T) {
	now := time.Now()
	ns := newTestNsResource()

	// Pre-compute ULIDs so both runs operate on identical input keys; if we
	// minted fresh ULIDs inside each run, ElementsMatch would be comparing
	// disjoint key sets and pass for the wrong reason.
	old15 := makeULID(t, now.Add(-3*time.Hour))
	new15 := makeULID(t, now.Add(-2*time.Hour))
	old16 := makeULID(t, now.Add(-3*time.Hour))
	new16 := makeULID(t, now.Add(-2*time.Hour))

	seed := func(ctx context.Context, bucket *blob.Bucket) {
		seedSnapshot(t, ctx, bucket, ns, old15, mkMeta("11.5.0", 100, now.Add(-3*time.Hour)))
		seedSnapshot(t, ctx, bucket, ns, new15, mkMeta("11.5.0", 200, now.Add(-2*time.Hour)))
		seedSnapshot(t, ctx, bucket, ns, old16, mkMeta("11.6.0", 100, now.Add(-3*time.Hour)))
		seedSnapshot(t, ctx, bucket, ns, new16, mkMeta("11.6.0", 200, now.Add(-2*time.Hour)))
	}

	runForVersion := func(version string) []ulid.ULID {
		ctx := context.Background()
		bucket, store := newCleanupTestBucket(t)
		seed(ctx, bucket)

		be, err := NewBleveBackend(BleveOptions{
			Root:          t.TempDir(),
			FileThreshold: 5,
			BuildVersion:  version,
			Snapshot: SnapshotOptions{
				Store:              store,
				MaxIndexAge:        7 * 24 * time.Hour,
				CleanupGracePeriod: 30 * time.Minute,
			},
		}, resource.ProvideIndexMetrics(prometheus.NewRegistry()))
		require.NoError(t, err)
		t.Cleanup(be.Stop)

		be.runCleanup(ctx)
		return listSeededIndexKeys(t, ctx, store, ns)
	}

	keptByV15 := runForVersion("11.5.0")
	keptByV16 := runForVersion("11.6.0")

	assert.ElementsMatch(t, keptByV15, keptByV16,
		"cleanup must produce the same delete set regardless of running version")
	// Belt-and-braces: assert cleanup actually deleted something. A no-op
	// cleanup would satisfy the equality above trivially.
	assert.ElementsMatch(t, []ulid.ULID{new15, new16}, keptByV15)
}

// --- end-to-end runCleanup tests against a memblob bucket ---

// seedSnapshot writes a minimal but valid snapshot at indexKey under ns,
// matching the layout BucketRemoteIndexStore expects: a single placeholder file
// plus a snapshot manifest declaring it. Bypasses store.UploadIndex so tests can pin
// arbitrary UploadTimestamps without being tied to wall-clock or ULID.Time().
// Takes *IndexMeta so callers can use mkMeta directly.
func seedSnapshot(t *testing.T, ctx context.Context, bucket *blob.Bucket, ns resource.NamespacedResource, indexKey ulid.ULID, meta *IndexMeta) {
	t.Helper()
	pfx := indexPrefix(ns, indexKey.String())
	require.NoError(t, bucket.WriteAll(ctx, pfx+"store/data.bin", []byte("x"), nil))
	if meta.Files == nil {
		meta.Files = map[string]int64{"store/data.bin": 1}
	}
	metaBytes, err := json.Marshal(meta)
	require.NoError(t, err)
	require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, metaBytes, nil))
}

// listSeededIndexKeys returns the index keys still present at ns in the bucket.
func listSeededIndexKeys(t *testing.T, ctx context.Context, store *BucketRemoteIndexStore, ns resource.NamespacedResource) []ulid.ULID {
	t.Helper()
	got, err := store.ListIndexes(ctx, ns)
	require.NoError(t, err)
	keys := make([]ulid.ULID, 0, len(got))
	for k := range got {
		keys = append(keys, k)
	}
	return keys
}

func newCleanupTestBackend(t *testing.T, store RemoteIndexStore, ownsFn func(resource.NamespacedResource) (bool, error)) (*bleveBackend, *resource.BleveIndexMetrics) {
	t.Helper()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:              store,
		MaxIndexAge:        7 * 24 * time.Hour,
		CleanupGracePeriod: 30 * time.Minute,
		// CleanupInterval intentionally left zero: tests drive runCleanup
		// directly so we don't depend on the background goroutine timing.
	})
	if ownsFn != nil {
		be.ownsIndexFn = ownsFn
	}
	return be, metrics
}

func TestRunCleanup_LockContentionSkipsNamespace(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })

	// Two storeA/storeB instances share the same bucket and lock backend so
	// that a lock acquired by storeA is observable by storeB. Constructed
	// directly rather than via newCleanupTestBucket because we need distinct
	// lock owners.
	backend := newFakeBackend(newConditionalBucket())
	lockOpts := LockOptions{TTL: 5 * time.Second, HeartbeatInterval: 500 * time.Millisecond}
	storeA := NewBucketRemoteIndexStore(BucketRemoteIndexStoreConfig{
		Bucket: bucket, LockBackend: backend, LockOwner: "instance-A",
		BuildLock: lockOpts, CleanupLock: lockOpts,
	})
	storeB := NewBucketRemoteIndexStore(BucketRemoteIndexStoreConfig{
		Bucket: bucket, LockBackend: backend, LockOwner: "instance-B",
		BuildLock: lockOpts, CleanupLock: lockOpts,
	})

	nsA := resource.NamespacedResource{Namespace: "stack-1", Group: "dashboard.grafana.app", Resource: "dashboards"}
	nsB := resource.NamespacedResource{Namespace: "stack-2", Group: "dashboard.grafana.app", Resource: "dashboards"}

	now := time.Now()
	old := makeULID(t, now.Add(-2*time.Hour))
	fresh := makeULID(t, now.Add(-time.Hour))
	for _, ns := range []resource.NamespacedResource{nsA, nsB} {
		seedSnapshot(t, ctx, bucket, ns, old, mkMeta("11.5.0", 100, now.Add(-2*time.Hour)))
		seedSnapshot(t, ctx, bucket, ns, fresh, mkMeta("11.5.0", 200, now.Add(-time.Hour)))
	}

	// instance-A pre-acquires the cleanup lock for stack-1; instance-B's runCleanup
	// must see the lock as held and skip it, but still process stack-2.
	heldLock, err := storeA.LockNamespaceForCleanup(ctx, nsA.Namespace)
	require.NoError(t, err)
	t.Cleanup(func() { _ = heldLock.Release() })

	be, metrics := newCleanupTestBackend(t, storeB, nil)
	be.runCleanup(ctx)

	keysA := listSeededIndexKeys(t, ctx, storeB, nsA)
	assert.ElementsMatch(t, []ulid.ULID{old, fresh}, keysA, "stack-1 must be untouched while its cleanup lock is held by another instance")

	keysB := listSeededIndexKeys(t, ctx, storeB, nsB)
	assert.Equal(t, []ulid.ULID{fresh}, keysB, "stack-2 must have its older snapshot cleaned up")

	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusSkipLockHeld)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusSuccess)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDeleted.WithLabelValues(snapshotDeleteOutcomeSuccess)))
}

func TestRunCleanup_IncompleteUploadsCounted(t *testing.T) {
	ctx := context.Background()
	bucket, store := newCleanupTestBucket(t)

	ns := newTestNsResource()
	old := makeULID(t, time.Now().Add(-48*time.Hour))
	pfx := indexPrefix(ns, old.String())
	// Stale prefix without a snapshot manifest — older than CleanupIncompleteUploads' minAge.
	require.NoError(t, bucket.WriteAll(ctx, pfx+"store/data.bin", []byte("partial"), nil))

	be, metrics := newCleanupTestBackend(t, store, nil)
	be.runCleanup(ctx)

	iter := bucket.List(&blob.ListOptions{Prefix: pfx})
	_, err := iter.Next(ctx)
	require.Error(t, err, "incomplete upload prefix must be removed")

	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotIncompleteUploadsCleaned))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusSuccess)))
}

func TestRunCleanup_DeletesPerRetentionRules(t *testing.T) {
	ctx := context.Background()
	bucket, store := newCleanupTestBucket(t)
	ns := newTestNsResource()

	now := time.Now()
	keep := makeULID(t, now.Add(-2*time.Hour))
	supersededOld := makeULID(t, now.Add(-3*time.Hour))
	tooOld := makeULID(t, now.Add(-10*24*time.Hour))

	seedSnapshot(t, ctx, bucket, ns, keep, mkMeta("11.5.0", 200, now.Add(-2*time.Hour)))
	seedSnapshot(t, ctx, bucket, ns, supersededOld, mkMeta("11.5.0", 100, now.Add(-3*time.Hour)))
	seedSnapshot(t, ctx, bucket, ns, tooOld, mkMeta("11.5.0", 50, now.Add(-10*24*time.Hour)))

	be, metrics := newCleanupTestBackend(t, store, nil)
	be.runCleanup(ctx)

	keys := listSeededIndexKeys(t, ctx, store, ns)
	assert.Equal(t, []ulid.ULID{keep}, keys)
	assert.Equal(t, 2.0, testutil.ToFloat64(metrics.IndexSnapshotDeleted.WithLabelValues(snapshotDeleteOutcomeSuccess)))
}

// --- ownership filter ---
//
// recordingStore wraps an inner RemoteIndexStore and counts every method call
// it sees, so tests can assert "this method was never called for that
// namespace". Used to pin down the namespace-only ownership assumption.
type recordingStore struct {
	inner RemoteIndexStore

	mu sync.Mutex
	// per-method counters
	listNamespaces       int
	listNamespaceIndexes map[string]int
	lockNamespaceCleanup map[string]int
	listIndexes          map[string]int // keyed by Namespace
	deleteIndex          map[string]int
	cleanupIncomplete    map[string]int
}

func newRecordingStore(inner RemoteIndexStore) *recordingStore {
	return &recordingStore{
		inner:                inner,
		listNamespaceIndexes: map[string]int{},
		lockNamespaceCleanup: map[string]int{},
		listIndexes:          map[string]int{},
		deleteIndex:          map[string]int{},
		cleanupIncomplete:    map[string]int{},
	}
}

func (s *recordingStore) ListNamespaces(ctx context.Context) ([]string, error) {
	s.mu.Lock()
	s.listNamespaces++
	s.mu.Unlock()
	return s.inner.ListNamespaces(ctx)
}
func (s *recordingStore) ListNamespaceIndexes(ctx context.Context, ns string) ([]resource.NamespacedResource, error) {
	s.mu.Lock()
	s.listNamespaceIndexes[ns]++
	s.mu.Unlock()
	return s.inner.ListNamespaceIndexes(ctx, ns)
}
func (s *recordingStore) LockNamespaceForCleanup(ctx context.Context, ns string) (IndexStoreLock, error) {
	s.mu.Lock()
	s.lockNamespaceCleanup[ns]++
	s.mu.Unlock()
	return s.inner.LockNamespaceForCleanup(ctx, ns)
}
func (s *recordingStore) ListIndexes(ctx context.Context, r resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error) {
	s.mu.Lock()
	s.listIndexes[r.Namespace]++
	s.mu.Unlock()
	return s.inner.ListIndexes(ctx, r)
}
func (s *recordingStore) ListIndexKeys(ctx context.Context, r resource.NamespacedResource) ([]ulid.ULID, error) {
	return s.inner.ListIndexKeys(ctx, r)
}
func (s *recordingStore) GetIndexMeta(ctx context.Context, r resource.NamespacedResource, k ulid.ULID) (*IndexMeta, error) {
	return s.inner.GetIndexMeta(ctx, r, k)
}
func (s *recordingStore) DeleteIndex(ctx context.Context, r resource.NamespacedResource, k ulid.ULID) error {
	s.mu.Lock()
	s.deleteIndex[r.Namespace]++
	s.mu.Unlock()
	return s.inner.DeleteIndex(ctx, r, k)
}
func (s *recordingStore) CleanupIncompleteUploads(ctx context.Context, r resource.NamespacedResource, minAge time.Duration) (int, error) {
	s.mu.Lock()
	s.cleanupIncomplete[r.Namespace]++
	s.mu.Unlock()
	return s.inner.CleanupIncompleteUploads(ctx, r, minAge)
}
func (s *recordingStore) LockBuildIndex(ctx context.Context, r resource.NamespacedResource) (IndexStoreLock, error) {
	return s.inner.LockBuildIndex(ctx, r)
}
func (s *recordingStore) UploadIndex(ctx context.Context, r resource.NamespacedResource, dir string, m IndexMeta) (ulid.ULID, error) {
	return s.inner.UploadIndex(ctx, r, dir, m)
}
func (s *recordingStore) DownloadIndex(ctx context.Context, r resource.NamespacedResource, k ulid.ULID, dest string) (*IndexMeta, error) {
	return s.inner.DownloadIndex(ctx, r, k, dest)
}

func TestRunCleanup_OwnershipFilter_NamespaceLevel(t *testing.T) {
	ctx := context.Background()
	bucket, inner := newCleanupTestBucket(t)
	store := newRecordingStore(inner)

	ownedNs := resource.NamespacedResource{Namespace: "ownedNs", Group: "dashboard.grafana.app", Resource: "dashboards"}
	unownedNs := resource.NamespacedResource{Namespace: "unownedNs", Group: "dashboard.grafana.app", Resource: "dashboards"}

	now := time.Now()
	old := makeULID(t, now.Add(-3*time.Hour))
	fresh := makeULID(t, now.Add(-2*time.Hour))
	for _, ns := range []resource.NamespacedResource{ownedNs, unownedNs} {
		seedSnapshot(t, ctx, bucket, ns, old, mkMeta("11.5.0", 100, now.Add(-3*time.Hour)))
		seedSnapshot(t, ctx, bucket, ns, fresh, mkMeta("11.5.0", 200, now.Add(-2*time.Hour)))
	}

	var ownsCalls atomic.Int32
	ownsFn := func(key resource.NamespacedResource) (bool, error) {
		ownsCalls.Add(1)
		// Pin down the contract: cleanup must call OwnsIndex with empty group/resource
		// because the production implementation hashes on Namespace alone. If a
		// future change to OwnsIndex starts considering Group/Resource, this
		// assertion will fire and force this code to be redesigned.
		assert.Empty(t, key.Group, "ownership probe must pass empty group")
		assert.Empty(t, key.Resource, "ownership probe must pass empty resource")
		return key.Namespace == "ownedNs", nil
	}

	be, metrics := newCleanupTestBackend(t, store, ownsFn)
	be.runCleanup(ctx)

	// Owned namespace: predecessor deleted; fresh kept.
	ownedKeys := listSeededIndexKeys(t, ctx, inner, ownedNs)
	assert.Equal(t, []ulid.ULID{fresh}, ownedKeys)
	// Unowned namespace: untouched.
	unownedKeys := listSeededIndexKeys(t, ctx, inner, unownedNs)
	assert.ElementsMatch(t, []ulid.ULID{old, fresh}, unownedKeys)

	// Both namespaces probed via ownsIndexFn.
	assert.Equal(t, int32(2), ownsCalls.Load())
	// Skip path for unowned namespace: zero of every store call beyond ListNamespaces.
	assert.Zero(t, store.listNamespaceIndexes["unownedNs"])
	assert.Zero(t, store.lockNamespaceCleanup["unownedNs"])
	assert.Zero(t, store.listIndexes["unownedNs"])
	assert.Zero(t, store.deleteIndex["unownedNs"])
	assert.Zero(t, store.cleanupIncomplete["unownedNs"])
	// And owned namespace is processed normally.
	assert.Equal(t, 1, store.listNamespaceIndexes["ownedNs"])
	assert.Equal(t, 1, store.lockNamespaceCleanup["ownedNs"])

	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusSkipUnowned)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusSuccess)))
}

// --- lock loss mid-run ---
//
// controllableLockStore returns locks whose Lost() channel can be closed by the
// test, simulating a heartbeat-detected lock loss without depending on the real
// objectStorageLock TTL/heartbeat timing.
type controllableLock struct {
	lost chan struct{}
}

func (l *controllableLock) Release() error        { return nil }
func (l *controllableLock) Lost() <-chan struct{} { return l.lost }
func (l *controllableLock) loseLock()             { close(l.lost) }

type controllableLockStore struct {
	inner RemoteIndexStore
	mu    sync.Mutex
	locks map[string]*controllableLock
	// onCleanupIncomplete fires after each CleanupIncompleteUploads call, with
	// the same context the inner store was invoked with. CleanupIncompleteUploads
	// is the last operation in runResourceCleanup, so this hook fires after a
	// resource has been fully cleaned — a deterministic point at which to
	// trigger lock loss so the next resource (rather than this one mid-flight)
	// is the one that observes the cancellation.
	onCleanupIncomplete func(ctx context.Context, r resource.NamespacedResource)
}

func (s *controllableLockStore) ListNamespaces(ctx context.Context) ([]string, error) {
	return s.inner.ListNamespaces(ctx)
}
func (s *controllableLockStore) ListNamespaceIndexes(ctx context.Context, ns string) ([]resource.NamespacedResource, error) {
	return s.inner.ListNamespaceIndexes(ctx, ns)
}
func (s *controllableLockStore) LockNamespaceForCleanup(_ context.Context, ns string) (IndexStoreLock, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.locks == nil {
		s.locks = map[string]*controllableLock{}
	}
	l := &controllableLock{lost: make(chan struct{})}
	s.locks[ns] = l
	return l, nil
}
func (s *controllableLockStore) ListIndexes(ctx context.Context, r resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error) {
	return s.inner.ListIndexes(ctx, r)
}
func (s *controllableLockStore) ListIndexKeys(ctx context.Context, r resource.NamespacedResource) ([]ulid.ULID, error) {
	return s.inner.ListIndexKeys(ctx, r)
}
func (s *controllableLockStore) GetIndexMeta(ctx context.Context, r resource.NamespacedResource, k ulid.ULID) (*IndexMeta, error) {
	return s.inner.GetIndexMeta(ctx, r, k)
}
func (s *controllableLockStore) DeleteIndex(ctx context.Context, r resource.NamespacedResource, k ulid.ULID) error {
	return s.inner.DeleteIndex(ctx, r, k)
}
func (s *controllableLockStore) CleanupIncompleteUploads(ctx context.Context, r resource.NamespacedResource, minAge time.Duration) (int, error) {
	out, err := s.inner.CleanupIncompleteUploads(ctx, r, minAge)
	if s.onCleanupIncomplete != nil {
		s.onCleanupIncomplete(ctx, r)
	}
	return out, err
}
func (s *controllableLockStore) LockBuildIndex(ctx context.Context, r resource.NamespacedResource) (IndexStoreLock, error) {
	return s.inner.LockBuildIndex(ctx, r)
}
func (s *controllableLockStore) UploadIndex(ctx context.Context, r resource.NamespacedResource, dir string, m IndexMeta) (ulid.ULID, error) {
	return s.inner.UploadIndex(ctx, r, dir, m)
}
func (s *controllableLockStore) DownloadIndex(ctx context.Context, r resource.NamespacedResource, k ulid.ULID, dest string) (*IndexMeta, error) {
	return s.inner.DownloadIndex(ctx, r, k, dest)
}

func TestRunCleanup_LockLossAbortsNamespace(t *testing.T) {
	ctx := context.Background()
	bucket, inner := newCleanupTestBucket(t)

	// Two resources in one namespace. Lose the lock after the first ListIndexes
	// call; the second resource must be untouched.
	ns := "stack-1"
	resA := resource.NamespacedResource{Namespace: ns, Group: "dashboard.grafana.app", Resource: "dashboards"}
	resB := resource.NamespacedResource{Namespace: ns, Group: "folder.grafana.app", Resource: "folders"}

	now := time.Now()
	oldA := makeULID(t, now.Add(-3*time.Hour))
	freshA := makeULID(t, now.Add(-2*time.Hour))
	oldB := makeULID(t, now.Add(-3*time.Hour))
	freshB := makeULID(t, now.Add(-2*time.Hour))

	for _, r := range []resource.NamespacedResource{resA, resB} {
		var oldKey, freshKey ulid.ULID
		if r == resA {
			oldKey, freshKey = oldA, freshA
		} else {
			oldKey, freshKey = oldB, freshB
		}
		seedSnapshot(t, ctx, bucket, r, oldKey, mkMeta("11.5.0", 100, now.Add(-3*time.Hour)))
		seedSnapshot(t, ctx, bucket, r, freshKey, mkMeta("11.5.0", 200, now.Add(-2*time.Hour)))
	}

	store := &controllableLockStore{inner: inner}
	var processed atomic.Int32
	store.onCleanupIncomplete = func(hookCtx context.Context, r resource.NamespacedResource) {
		// Fire lock loss after the first resource has fully completed. Then wait
		// for the watcher goroutine to propagate cancellation through nsCtx, so
		// the next resource deterministically observes a cancelled context
		// rather than racing the watcher.
		if processed.Add(1) != 1 {
			return
		}
		store.mu.Lock()
		l := store.locks[ns]
		store.mu.Unlock()
		l.loseLock()
		select {
		case <-hookCtx.Done():
		case <-time.After(2 * time.Second):
			t.Fatal("per-namespace ctx was not cancelled within 2s of lock loss")
		}
	}

	be, metrics := newCleanupTestBackend(t, store, nil)
	be.runCleanup(ctx)

	// Exactly one of {resA, resB} should have been cleaned (the first one
	// processed in random order); the other must be untouched.
	keysA := listSeededIndexKeys(t, ctx, inner, resA)
	keysB := listSeededIndexKeys(t, ctx, inner, resB)
	totalSurviving := len(keysA) + len(keysB)
	assert.Equal(t, 3, totalSurviving, "lock loss must abort processing of remaining resources")

	// Only one Delete fired; lock loss is reported as an error.
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDeleted.WithLabelValues(snapshotDeleteOutcomeSuccess)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusError)))
}

// --- lifecycle ---

func TestCleanupSnapshotsPeriodically_LifecycleExitsOnContextCancel(t *testing.T) {
	_, store := newCleanupTestBucket(t)

	// CleanupInterval > 0 makes NewBleveBackend start the cleanup goroutine.
	// 1h is long enough that the initial jittered delay parks the goroutine in
	// its select; we then verify Stop unblocks it via bgTasksCancel/Wait.
	be, _ := newTestBleveBackend(t, SnapshotOptions{
		Store:           store,
		MaxIndexAge:     7 * 24 * time.Hour,
		CleanupInterval: time.Hour,
	})

	done := make(chan struct{})
	go func() {
		be.Stop()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("bleveBackend.Stop did not return — cleanup goroutine likely leaking")
	}
}

// --- error paths ---

// listNamespacesErrStore returns an error from ListNamespaces. We use it to
// verify that runCleanup attributes the failure to a single "error" cleanup
// counter increment.
type listNamespacesErrStore struct {
	RemoteIndexStore
	err error
}

func (s *listNamespacesErrStore) ListNamespaces(context.Context) ([]string, error) {
	return nil, s.err
}

func TestRunCleanup_ListNamespacesErrorRecorded(t *testing.T) {
	_, inner := newCleanupTestBucket(t)

	store := &listNamespacesErrStore{RemoteIndexStore: inner, err: errors.New("network down")}
	be, metrics := newCleanupTestBackend(t, store, nil)
	be.runCleanup(context.Background())

	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusError)))
}

// deleteFailingStore wraps an inner store and forces every DeleteIndex call to
// return an error, so we can exercise the per-snapshot failure path without
// depending on bucket internals.
type deleteFailingStore struct {
	RemoteIndexStore
	err error
}

func (s *deleteFailingStore) DeleteIndex(context.Context, resource.NamespacedResource, ulid.ULID) error {
	return s.err
}

func TestRunCleanup_DeleteFailureRecordedAndFlipsNamespaceStatus(t *testing.T) {
	ctx := context.Background()
	bucket, inner := newCleanupTestBucket(t)
	ns := newTestNsResource()

	now := time.Now()
	old := makeULID(t, now.Add(-3*time.Hour))
	fresh := makeULID(t, now.Add(-2*time.Hour))
	seedSnapshot(t, ctx, bucket, ns, old, mkMeta("11.5.0", 100, now.Add(-3*time.Hour)))
	seedSnapshot(t, ctx, bucket, ns, fresh, mkMeta("11.5.0", 200, now.Add(-2*time.Hour)))

	store := &deleteFailingStore{RemoteIndexStore: inner, err: errors.New("bucket 5xx")}
	be, metrics := newCleanupTestBackend(t, store, nil)
	be.runCleanup(ctx)

	// Per-snapshot failure recorded under outcome=error; nothing under success.
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDeleted.WithLabelValues(snapshotDeleteOutcomeError)))
	assert.Equal(t, 0.0, testutil.ToFloat64(metrics.IndexSnapshotDeleted.WithLabelValues(snapshotDeleteOutcomeSuccess)))

	// Namespace status flips to error — cleanup ran to completion but the
	// delete that should have succeeded didn't, so this isn't a "success".
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusError)))
	assert.Equal(t, 0.0, testutil.ToFloat64(metrics.IndexSnapshotNamespaceCleanups.WithLabelValues(snapshotNamespaceCleanupStatusSuccess)))

	// Bucket state confirms the delete didn't actually happen.
	assert.ElementsMatch(t, []ulid.ULID{old, fresh}, listSeededIndexKeys(t, ctx, inner, ns))
}

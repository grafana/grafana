package search

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	badger "github.com/dgraph-io/badger/v4"
	"github.com/oklog/ulid/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

// kvTestMinTTL is the lease TTL used by KV-store tests. Short enough that
// lock contention tests don't waste real time, long enough that the
// auto-renew loop's TTL/3 interval doesn't generate too much churn.
const kvTestMinTTL = 200 * time.Millisecond

func newTestBadgerKV(t *testing.T) kv.KV {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return kv.NewBadgerKV(db)
}

func newTestLeaseManager(t *testing.T, store kv.KV, holder string) *lease.Manager {
	t.Helper()
	mgr := lease.NewManager(store, holder, nil,
		lease.WithInternalMinTTL(kvTestMinTTL),
		lease.WithGarbageCollectionDisabled,
	)
	t.Cleanup(func() { mgr.Stop() })
	return mgr
}

func newTestKVRemoteIndexStore(t *testing.T) *KVRemoteIndexStore {
	t.Helper()
	return newTestKVRemoteIndexStoreWithOwner(t, "test-owner")
}

func newTestKVRemoteIndexStoreWithOwner(t *testing.T, owner string) *KVRemoteIndexStore {
	t.Helper()
	store := newTestBadgerKV(t)
	return newTestKVRemoteIndexStoreOn(t, store, owner)
}

func newTestKVRemoteIndexStoreOn(t *testing.T, store kv.KV, owner string) *KVRemoteIndexStore {
	t.Helper()
	mgr := newTestLeaseManager(t, store, owner)
	s, err := NewKVRemoteIndexStore(KVRemoteIndexStoreConfig{
		KV:           store,
		LeaseManager: mgr,
		BuildLock:    LockOptions{TTL: kvTestMinTTL},
		CleanupLock:  LockOptions{TTL: kvTestMinTTL},
	})
	require.NoError(t, err)
	return s
}

func TestKVRemoteIndexStore_New_RejectsInvalidConfig(t *testing.T) {
	store := newTestBadgerKV(t)
	mgr := newTestLeaseManager(t, store, "owner")

	_, err := NewKVRemoteIndexStore(KVRemoteIndexStoreConfig{LeaseManager: mgr})
	require.ErrorContains(t, err, "kv store is required")

	_, err = NewKVRemoteIndexStore(KVRemoteIndexStoreConfig{KV: store})
	require.ErrorContains(t, err, "lease manager is required")
}

// TestKVRemoteIndexStore_SectionsAreDistinct guards against accidentally
// editing IndexSnapshotManifestSection / IndexSnapshotDataSection to the
// same value, or to collide with kv.LeasesSection (which would let snapshot
// data trample lease metadata).
func TestKVRemoteIndexStore_SectionsAreDistinct(t *testing.T) {
	sections := []string{
		IndexSnapshotManifestSection,
		IndexSnapshotDataSection,
		kv.LeasesSection,
	}
	seen := map[string]struct{}{}
	for _, s := range sections {
		require.NotEmpty(t, s)
		_, dup := seen[s]
		require.False(t, dup, "section %q must be unique across snapshot and lease use", s)
		seen[s] = struct{}{}
	}
}

func TestKVRemoteIndexStore_UploadDownloadBleveIndex(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	buildStart := time.Now().Add(-2 * time.Hour).UTC().Truncate(time.Second)
	meta := IndexMeta{
		BuildVersion:          "11.0.0",
		LatestResourceVersion: 99,
		BuildTime:             buildStart,
	}

	indexKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)
	t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

	destDir := filepath.Join(t.TempDir(), "downloaded")
	gotMeta, err := DownloadIndexSnapshot(ctx, store, ns, indexKey, destDir)
	require.NoError(t, err)
	assert.Equal(t, meta.BuildVersion, gotMeta.BuildVersion)
	assert.Equal(t, meta.LatestResourceVersion, gotMeta.LatestResourceVersion)
	assert.True(t, gotMeta.BuildTime.Equal(buildStart))

	// Open and query the downloaded index to confirm the data round-tripped.
	idx, err := bleve.Open(destDir)
	require.NoError(t, err)
	count, err := idx.DocCount()
	require.NoError(t, err)
	assert.Equal(t, uint64(3), count)
	result, err := idx.Search(bleve.NewSearchRequest(bleve.NewMatchQuery("Production")))
	require.NoError(t, err)
	assert.Equal(t, uint64(1), result.Total)
	require.NoError(t, idx.Close())
}

func TestKVRemoteIndexStore_ListAndDeleteIndexes(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()
	ns := newTestNsResource()

	keys := make([]ulid.ULID, 0, 3)
	for range 3 {
		srcDir := createTestBleveIndex(t)
		meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
		key, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
		require.NoError(t, err)
		keys = append(keys, key)
	}

	indexes, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	assert.Len(t, indexes, 3)
	for _, key := range keys {
		assert.Contains(t, indexes, key)
	}

	for _, key := range keys {
		require.NoError(t, store.DeleteIndex(ctx, ns, key))
	}

	indexes, err = ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	assert.Empty(t, indexes)

	// Confirm nothing was left behind under the snapshot prefix in either
	// section for any of the keys.
	for _, key := range keys {
		assertNoDataKeys(t, store, ns, key)
		assertNoManifestKey(t, store, ns, key)
	}
}

func TestKVRemoteIndexStore_DeleteIndex_LargeFileCount(t *testing.T) {
	// Exercises the BatchDelete chunking path: more files than kvDeleteBatchSize.
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()
	ns := newTestNsResource()
	key := ulid.Make()

	const fileCount = kvDeleteBatchSize*2 + 5
	files := make(map[string]int64, fileCount)
	for i := range fileCount {
		rel := fmt.Sprintf("store/file-%03d", i)
		files[rel] = 4
		writeKVValue(t, store.store, IndexSnapshotDataSection, store.dataKey(ns, key, rel), []byte("data"))
	}
	metaBytes, err := json.Marshal(IndexMeta{BuildVersion: "11.0.0", Files: files})
	require.NoError(t, err)
	require.NoError(t, store.WriteSnapshotManifest(ctx, ns, key, metaBytes))

	require.NoError(t, store.DeleteIndex(ctx, ns, key))
	assertNoDataKeys(t, store, ns, key)
	assertNoManifestKey(t, store, ns, key)
}

func TestKVRemoteIndexStore_ReadSnapshotManifest_MissingReturnsNotFound(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	_, err := store.ReadSnapshotManifest(t.Context(), newTestNsResource(), ulid.Make())
	require.ErrorIs(t, err, ErrSnapshotNotFound)
}

func TestKVRemoteIndexStore_ReadSnapshotFile_MissingReturnsNotFound(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	err := store.ReadSnapshotFile(t.Context(), newTestNsResource(), ulid.Make(), "store/missing", newTempOSFile(t), 100)
	require.ErrorIs(t, err, ErrSnapshotNotFound)
}

func TestKVRemoteIndexStore_ReadSnapshotFile_OversizedFails(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()
	key := ulid.Make()

	// Plant a 100-byte value but advertise it as 10.
	const advertised = 10
	writeKVValue(t, store.store, IndexSnapshotDataSection, store.dataKey(ns, key, "store/root.bolt"), bytes.Repeat([]byte("x"), 100))

	err := store.ReadSnapshotFile(t.Context(), ns, key, "store/root.bolt", newTempOSFile(t), advertised)
	require.Error(t, err)
	require.ErrorIs(t, err, resource.ErrWriteLimitExceeded)
}

func TestKVRemoteIndexStore_DownloadRejectsOversizedFile(t *testing.T) {
	// End-to-end version: an oversized data file must fail through the
	// DownloadIndexSnapshot helper, exposing ErrWriteLimitExceeded.
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()
	ns := newTestNsResource()
	key := ulid.Make()

	const advertised = 10
	meta := IndexMeta{
		BuildVersion: "11.0.0",
		Files:        map[string]int64{"store/root.bolt": advertised},
	}
	metaBytes, err := json.Marshal(meta)
	require.NoError(t, err)
	require.NoError(t, store.WriteSnapshotManifest(ctx, ns, key, metaBytes))

	writeKVValue(t, store.store, IndexSnapshotDataSection, store.dataKey(ns, key, "store/root.bolt"), bytes.Repeat([]byte("x"), advertised*1000))

	_, err = DownloadIndexSnapshot(ctx, store, ns, key, filepath.Join(t.TempDir(), "dl"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "exceeds expected size")
}

func TestKVRemoteIndexStore_ListNamespaces(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()

	for _, ns := range []string{"stack-1", "stack-2", "stack-3"} {
		nsRes := resource.NamespacedResource{Namespace: ns, Group: "dashboard.grafana.app", Resource: "dashboards"}
		_, err := UploadIndexSnapshot(ctx, store, nsRes, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 1}, testLogger)
		require.NoError(t, err)
	}

	got, err := store.ListNamespaces(ctx)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"stack-1", "stack-2", "stack-3"}, got)
}

func TestKVRemoteIndexStore_ListNamespaces_Empty(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	got, err := store.ListNamespaces(t.Context())
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestKVRemoteIndexStore_ListNamespaceResources(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()

	resources := []resource.NamespacedResource{
		{Namespace: "stack-1", Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Namespace: "stack-1", Group: "folder.grafana.app", Resource: "folders"},
		{Namespace: "stack-2", Group: "dashboard.grafana.app", Resource: "dashboards"},
	}
	for _, r := range resources {
		_, err := UploadIndexSnapshot(ctx, store, r, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 1}, testLogger)
		require.NoError(t, err)
	}

	got, err := store.ListNamespaceResources(ctx, "stack-1")
	require.NoError(t, err)
	assert.ElementsMatch(t, []resource.NamespacedResource{
		{Namespace: "stack-1", Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Namespace: "stack-1", Group: "folder.grafana.app", Resource: "folders"},
	}, got)

	got, err = store.ListNamespaceResources(ctx, "stack-2")
	require.NoError(t, err)
	assert.ElementsMatch(t, []resource.NamespacedResource{
		{Namespace: "stack-2", Group: "dashboard.grafana.app", Resource: "dashboards"},
	}, got)
}

func TestKVRemoteIndexStore_ListIndexKeys_SkipsNonULID(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()
	ns := newTestNsResource()

	indexKey, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
		IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 1}, testLogger)
	require.NoError(t, err)

	// Plant a sibling in the manifest section whose final segment is not a
	// ULID. Shouldn't occur in production, but we want ListIndexKeys to be
	// defensive: parse failures must not abort the listing.
	writeKVValue(t, store.store, IndexSnapshotManifestSection, kvResourcePrefix(ns)+"not-a-ulid", []byte("x"))

	keys, err := store.ListIndexKeys(ctx, ns)
	require.NoError(t, err)
	assert.Equal(t, []ulid.ULID{indexKey}, keys)
}

// TestKVRemoteIndexStore_ListingSemantics pins down the divergent semantics
// of the two listing paths:
//
//   - ListIndexKeys reads the manifest section and returns ONLY complete
//     snapshots (deliberate divergence from the bucket store's "may include
//     incomplete" contract).
//   - ListNamespaces / ListNamespaceResources read the data section and
//     return ALL namespaces / resources that have any snapshot data
//     (complete or incomplete), so the cleanup pass can still reach
//     namespaces whose only snapshots are partial uploads.
//
// Two scenarios cover the cases that matter: a namespace with both kinds
// of snapshots, and a namespace with only incomplete uploads.
func TestKVRemoteIndexStore_ListingSemantics(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()

	nsMixed := newTestNsResource()
	completeKey, err := UploadIndexSnapshot(ctx, store, nsMixed, createTestBleveIndex(t),
		IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 1}, testLogger)
	require.NoError(t, err)
	seedIncompleteSnapshot(t, store, nsMixed, ulid.Make())

	nsOrphansOnly := resource.NamespacedResource{
		Namespace: "orphans-only",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	seedIncompleteSnapshot(t, store, nsOrphansOnly, ulid.Make())

	t.Run("ListIndexKeys returns only complete snapshots", func(t *testing.T) {
		keys, err := store.ListIndexKeys(ctx, nsMixed)
		require.NoError(t, err)
		assert.Equal(t, []ulid.ULID{completeKey}, keys)

		keys, err = store.ListIndexKeys(ctx, nsOrphansOnly)
		require.NoError(t, err)
		assert.Empty(t, keys, "a namespace with only incomplete uploads must not surface any ULIDs")
	})

	t.Run("ListNamespaces returns namespaces with complete or incomplete snapshots", func(t *testing.T) {
		namespaces, err := store.ListNamespaces(ctx)
		require.NoError(t, err)
		assert.Contains(t, namespaces, nsMixed.Namespace)
		assert.Contains(t, namespaces, nsOrphansOnly.Namespace)
	})

	t.Run("ListNamespaceResources returns resources with complete or incomplete snapshots", func(t *testing.T) {
		resources, err := store.ListNamespaceResources(ctx, nsMixed.Namespace)
		require.NoError(t, err)
		assert.Contains(t, resources, nsMixed)

		resources, err = store.ListNamespaceResources(ctx, nsOrphansOnly.Namespace)
		require.NoError(t, err)
		assert.Contains(t, resources, nsOrphansOnly)
	})
}

// TestKVRemoteIndexStore_CleanupIncompleteIndexSnapshots_KnownBroken
// documents a known limitation of the KV backend:
// CleanupIncompleteIndexSnapshots cannot detect incomplete uploads because
// ListIndexKeys only lists the manifest section. Once incomplete-upload
// detection moves into the backend, this test should be replaced with a
// real cleanup test.
func TestKVRemoteIndexStore_CleanupIncompleteIndexSnapshots_KnownBroken(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	incompleteKey := ulid.Make()
	planted := seedIncompleteSnapshot(t, store, ns, incompleteKey)

	cleaned, err := CleanupIncompleteIndexSnapshots(t.Context(), store, ns, time.Now(), testLogger)
	require.NoError(t, err)
	assert.Equal(t, 0, cleaned, "incomplete uploads are not currently detected on the KV backend")

	leftover := collectDataKeys(t, store, ns, incompleteKey)
	assert.Len(t, leftover, len(planted), "orphaned data files remain on the KV backend; cleanup of incomplete uploads is not yet implemented here")
}

// --- Locking ---

func TestKVRemoteIndexStore_LockBuildIndex_AcquireRelease(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)

	lock, err := store.LockBuildIndex(t.Context(), newTestNsResource(), "11.5.0")
	require.NoError(t, err)
	select {
	case <-lock.Lost():
		t.Fatal("lock should not be lost")
	default:
	}
	require.NoError(t, lock.Release())
}

func TestKVRemoteIndexStore_LockBuildIndex_Contention(t *testing.T) {
	backing := newTestBadgerKV(t)
	ctx := t.Context()
	ns := newTestNsResource()

	store1 := newTestKVRemoteIndexStoreOn(t, backing, "instance-1")
	store2 := newTestKVRemoteIndexStoreOn(t, backing, "instance-2")

	lock1, err := store1.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = lock1.Release() })

	_, err = store2.LockBuildIndex(ctx, ns, "11.5.0")
	require.Error(t, err)
	require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)

	require.NoError(t, lock1.Release())

	// After release, the next acquisition succeeds. The lease key is updated
	// (the tombstoned entry is still present, but Acquire sees it as not
	// valid as-of now), so we expect a fresh lock.
	lock2, err := store2.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	require.NoError(t, lock2.Release())
}

func TestKVRemoteIndexStore_LockBuildIndex_VersionScoped(t *testing.T) {
	backing := newTestBadgerKV(t)
	ctx := t.Context()
	ns := newTestNsResource()

	store1 := newTestKVRemoteIndexStoreOn(t, backing, "instance-1")
	store2 := newTestKVRemoteIndexStoreOn(t, backing, "instance-2")

	lock1, err := store1.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = lock1.Release() })

	// Different build version is a distinct key, so it's acquirable.
	lock2, err := store2.LockBuildIndex(ctx, ns, "11.6.0")
	require.NoError(t, err)
	require.NoError(t, lock2.Release())
}

func TestKVRemoteIndexStore_LockBuildIndex_RequiresBuildVersion(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	_, err := store.LockBuildIndex(t.Context(), newTestNsResource(), "")
	require.Error(t, err)
}

func TestKVRemoteIndexStore_LockNamespaceForCleanup_DistinctFromBuildLock(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()
	ns := newTestNsResource()

	cleanupLock, err := store.LockNamespaceForCleanup(ctx, ns.Namespace)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cleanupLock.Release() })

	buildLock, err := store.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	require.NoError(t, buildLock.Release())
}

func TestKVRemoteIndexStore_LockNamespaceForCleanup_Contention(t *testing.T) {
	backing := newTestBadgerKV(t)
	ctx := t.Context()

	store1 := newTestKVRemoteIndexStoreOn(t, backing, "instance-1")
	store2 := newTestKVRemoteIndexStoreOn(t, backing, "instance-2")

	lock1, err := store1.LockNamespaceForCleanup(ctx, "stack-1")
	require.NoError(t, err)
	t.Cleanup(func() { _ = lock1.Release() })

	_, err = store2.LockNamespaceForCleanup(ctx, "stack-1")
	require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)

	// Different namespace must be acquirable independently.
	lock2, err := store2.LockNamespaceForCleanup(ctx, "stack-2")
	require.NoError(t, err)
	require.NoError(t, lock2.Release())
}

// TestKVRemoteIndexStore_LockBuildIndex_LossOnExpiry confirms that an
// expired auto-renewed lease (here, because a competing holder takes over)
// is surfaced through the IndexStoreLock's Lost() channel.
func TestKVRemoteIndexStore_LockBuildIndex_LossOnExpiry(t *testing.T) {
	backing := newTestBadgerKV(t)
	ctx := t.Context()
	ns := newTestNsResource()

	// Two managers sharing the same KV — distinct holders.
	mgr1 := newTestLeaseManager(t, backing, "instance-1")
	mgr2 := newTestLeaseManager(t, backing, "instance-2")

	// Acquire via mgr1 without auto-renew so we can let it expire and have
	// mgr2 take over. We bypass the store's helper and use mgr1 directly so
	// we control auto-renew. The store's lock plumbing is exercised by the
	// other tests; here we're verifying Lost() wiring on a kvIndexStoreLock
	// wrapping a real lost lease.
	name := buildIndexLockKey(ns, "11.5.0")
	l1, err := mgr1.Acquire(ctx, name, lease.WithTTL(kvTestMinTTL))
	require.NoError(t, err)

	// Wait until the lease expires from mgr1's perspective.
	time.Sleep(kvTestMinTTL * 3 / 2)

	// mgr2 acquires the same lease, with auto-renew. Wrap it in our adapter
	// to confirm Lost() is plumbed through.
	l2, err := mgr2.Acquire(ctx, name, lease.WithTTL(kvTestMinTTL), lease.WithAutoRenew())
	require.NoError(t, err)
	adapter := &kvIndexStoreLock{
		mgr:            mgr2,
		lease:          l2,
		releaseTimeout: defaultKVReleaseTimeout,
	}
	t.Cleanup(func() { _ = adapter.Release() })

	// mgr1's lease was expired before mgr2 took over; releasing it should
	// return ErrLeaseLost (no auto-renew, so notifyLoss happens on Release).
	err = mgr1.Release(ctx, l1)
	require.ErrorIs(t, err, lease.ErrLeaseLost)

	// adapter (mgr2) is still healthy.
	select {
	case <-adapter.Lost():
		t.Fatal("mgr2's lock should not be lost yet")
	default:
	}
}

// TestKVIndexStoreLock_Release_AfterRevocation confirms the adapter's
// Release surfaces ErrLeaseLost when the underlying lease has been
// revoked out-of-band.
func TestKVIndexStoreLock_Release_AfterRevocation(t *testing.T) {
	backing := newTestBadgerKV(t)
	ctx := t.Context()

	mgr1 := newTestLeaseManager(t, backing, "instance-1")
	mgr2 := newTestLeaseManager(t, backing, "instance-2")

	name := "test/revoke"

	l1, err := mgr1.Acquire(ctx, name, lease.WithTTL(kvTestMinTTL))
	require.NoError(t, err)
	adapter := &kvIndexStoreLock{
		mgr:            mgr1,
		lease:          l1,
		releaseTimeout: defaultKVReleaseTimeout,
	}

	// Wait out the TTL, then have mgr2 take over.
	time.Sleep(kvTestMinTTL * 3 / 2)
	l2, err := mgr2.Acquire(ctx, name, lease.WithTTL(kvTestMinTTL))
	require.NoError(t, err)
	t.Cleanup(func() { _ = mgr2.Release(ctx, l2) })

	// Releasing the original adapter returns ErrLeaseLost, unwrapped.
	err = adapter.Release()
	require.ErrorIs(t, err, lease.ErrLeaseLost)
}

// TestKVLeaseNames_Valid confirms that the KV store's lease-name helpers
// produce names accepted by lease.Manager.Acquire. The lease package rejects
// names that fail kv.IsValidKey, contain `~`, or start with `lease-internal/`.
func TestKVLeaseNames_Valid(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)

	buildTests := []struct {
		name         string
		ns           resource.NamespacedResource
		buildVersion string
	}{
		{"plain", newTestNsResource(), "11.5.0"},
		{"semver with plus and slash", newTestNsResource(), "v11.5.0+security/branch"},
		{"dotted group", resource.NamespacedResource{
			Namespace: "stack-1",
			Group:     "alerting.notifications.grafana.app",
			Resource:  "templates",
		}, "11.5.0"},
	}
	for _, tt := range buildTests {
		t.Run("build/"+tt.name, func(t *testing.T) {
			name := kvBuildLeaseName(tt.ns, tt.buildVersion)
			assert.True(t, kv.IsValidKey(name), "lease name %q must satisfy kv.IsValidKey", name)
			assert.NotContains(t, name, "~", "lease name %q must not contain ~", name)
			assert.True(t, strings.HasPrefix(name, kvBuildLeasePrefix+"/"), "lease name %q should be identifiable by prefix", name)

			// Must round-trip through Acquire successfully.
			lock, err := store.LockBuildIndex(t.Context(), tt.ns, tt.buildVersion)
			require.NoError(t, err)
			require.NoError(t, lock.Release())
		})
	}

	for _, ns := range []string{"stack-1", "default"} {
		t.Run("cleanup/"+ns, func(t *testing.T) {
			name := kvCleanupLeaseName(ns)
			assert.True(t, kv.IsValidKey(name), "lease name %q must satisfy kv.IsValidKey", name)
			assert.NotContains(t, name, "~", "lease name %q must not contain ~", name)
			assert.True(t, strings.HasPrefix(name, kvCleanupLeasePrefix+"/"), "lease name %q should be identifiable by prefix", name)
		})
	}
}

// TestKVRemoteIndexStore_RejectsInvalidNsResource pins the validation at
// public-method entry points: namespaces, resources, and groups that would
// produce ambiguous or lossy KV keys must be rejected.
func TestKVRemoteIndexStore_RejectsInvalidNsResource(t *testing.T) {
	store := newTestKVRemoteIndexStore(t)
	ctx := t.Context()

	// Each fixture flips exactly one field to an invalid value so the
	// rejection is attributable to a specific invariant rather than e.g.
	// length on a different field.
	valid := newTestNsResource()
	bad := []struct {
		name string
		ns   resource.NamespacedResource
	}{
		{"empty namespace", resource.NamespacedResource{Namespace: "", Group: valid.Group, Resource: valid.Resource}},
		{"slash in namespace", resource.NamespacedResource{Namespace: "ns/x", Group: valid.Group, Resource: valid.Resource}},
		{"tilde in namespace", resource.NamespacedResource{Namespace: "ns~x", Group: valid.Group, Resource: valid.Resource}},
		{"empty resource", resource.NamespacedResource{Namespace: valid.Namespace, Group: valid.Group, Resource: ""}},
		{"slash in resource", resource.NamespacedResource{Namespace: valid.Namespace, Group: valid.Group, Resource: "a/b"}},
		{"dot in resource", resource.NamespacedResource{Namespace: valid.Namespace, Group: valid.Group, Resource: "a.b"}},
		{"empty group", resource.NamespacedResource{Namespace: valid.Namespace, Group: "", Resource: valid.Resource}},
		{"slash in group", resource.NamespacedResource{Namespace: valid.Namespace, Group: "grp/x", Resource: valid.Resource}},
	}
	for _, tt := range bad {
		t.Run(tt.name, func(t *testing.T) {
			_, err := store.ListIndexKeys(ctx, tt.ns)
			require.Error(t, err)
			_, err = store.ReadSnapshotManifest(ctx, tt.ns, ulid.Make())
			require.Error(t, err)
			err = store.DeleteIndex(ctx, tt.ns, ulid.Make())
			require.Error(t, err)
			_, err = store.LockBuildIndex(ctx, tt.ns, "11.0.0")
			require.Error(t, err)
		})
	}

	t.Run("slash in namespace via LockNamespaceForCleanup", func(t *testing.T) {
		_, err := store.LockNamespaceForCleanup(ctx, "ns/x")
		require.Error(t, err)
	})
	t.Run("empty namespace via ListNamespaceResources", func(t *testing.T) {
		_, err := store.ListNamespaceResources(ctx, "")
		require.Error(t, err)
	})
}

func TestIsRetryableSnapshotStoreError_KVErrRetryable(t *testing.T) {
	// kv.ErrRetryable wraps a backend's transient error. Confirm
	// isRetryableSnapshotStoreError treats both the sentinel itself and an
	// error wrapping it as retryable.
	ctx := t.Context()

	assert.True(t, isRetryableSnapshotStoreError(ctx, kv.ErrRetryable))
	assert.True(t, isRetryableSnapshotStoreError(ctx,
		fmt.Errorf("fetching snapshot file: %w", kv.ErrRetryable)))

	// Sanity-check that non-retryable errors still aren't retryable.
	assert.False(t, isRetryableSnapshotStoreError(ctx, ErrSnapshotNotFound))
	assert.False(t, isRetryableSnapshotStoreError(ctx, errors.New("plain error")))

	// Cancelled context disables retries regardless of error.
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	assert.False(t, isRetryableSnapshotStoreError(cancelled, kv.ErrRetryable))
}

// --- helpers ---

// newTempOSFile returns a freshly-created *os.File in t.TempDir, closed by
// t.Cleanup. Used as the destination for ReadSnapshotFile in tests.
func newTempOSFile(t *testing.T) *os.File {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "kv-test-*")
	require.NoError(t, err)
	t.Cleanup(func() { _ = f.Close() })
	return f
}

// writeKVValue stores data at (section, key) via the KV store's Save API.
// Used by tests that need to plant values directly, bypassing the
// RemoteIndexStore methods.
func writeKVValue(t *testing.T, store kv.KV, section, key string, data []byte) {
	t.Helper()
	w, err := store.Save(t.Context(), section, key)
	require.NoError(t, err)
	_, err = w.Write(data)
	require.NoError(t, err)
	require.NoError(t, w.Close())
}

// orphanedSnapshotFiles is the canonical set of fake data-file paths used
// by tests that simulate an interrupted upload.
var orphanedSnapshotFiles = []string{"store/root.bolt", "store/00000001.zap"}

// seedIncompleteSnapshot writes a few fake data files (no manifest) under
// the given (ns, key) prefix, simulating an upload that crashed before the
// completion signal was written. Returns the relative paths planted.
func seedIncompleteSnapshot(t *testing.T, s *KVRemoteIndexStore, ns resource.NamespacedResource, key ulid.ULID) []string {
	t.Helper()
	for _, rel := range orphanedSnapshotFiles {
		writeKVValue(t, s.store, IndexSnapshotDataSection, s.dataKey(ns, key, rel), []byte("orphaned"))
	}
	return orphanedSnapshotFiles
}

// collectDataKeys returns every key remaining under the given snapshot's
// data-section prefix.
func collectDataKeys(t *testing.T, s *KVRemoteIndexStore, ns resource.NamespacedResource, key ulid.ULID) []string {
	t.Helper()
	prefix := kvDataPrefix(ns, key)
	var got []string
	for k, err := range s.store.Keys(t.Context(), IndexSnapshotDataSection, kv.ListOptions{
		StartKey: prefix,
		EndKey:   kv.PrefixRangeEnd(prefix),
	}) {
		require.NoError(t, err)
		got = append(got, k)
	}
	return got
}

// assertNoDataKeys fails the test if any key remains under the snapshot's
// data-section prefix.
func assertNoDataKeys(t *testing.T, s *KVRemoteIndexStore, ns resource.NamespacedResource, key ulid.ULID) {
	t.Helper()
	if got := collectDataKeys(t, s, ns, key); len(got) > 0 {
		t.Fatalf("unexpected leftover data keys: %v", got)
	}
}

// assertNoManifestKey fails the test if the manifest for the given snapshot
// is still present.
func assertNoManifestKey(t *testing.T, s *KVRemoteIndexStore, ns resource.NamespacedResource, key ulid.ULID) {
	t.Helper()
	_, err := s.store.Get(t.Context(), IndexSnapshotManifestSection, s.manifestKey(ns, key))
	require.ErrorIs(t, err, kv.ErrNotFound, "manifest still present for %s", key)
}

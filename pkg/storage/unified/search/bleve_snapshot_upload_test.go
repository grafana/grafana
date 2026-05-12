package search

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func newUploadTestIndex(t *testing.T, be *bleveBackend, key resource.NamespacedResource, rv int64) *bleveIndex {
	t.Helper()
	resourceDir := be.getResourceDir(key)
	require.NoError(t, os.MkdirAll(resourceDir, 0o750))

	idx, err := newBleveIndex(filepath.Join(resourceDir, formatIndexName(time.Now())), bleve.NewIndexMapping(), time.Now(), be.opts.BuildVersion, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = idx.Close() })

	require.NoError(t, idx.Index("dash-1", map[string]string{"title": "Production Overview"}))
	require.NoError(t, setRV(idx, rv))

	wrapped := be.newBleveIndex(key, idx, indexStorageFile, nil, nil, nil, nil, be.log)
	wrapped.resourceVersion.Store(rv)
	return wrapped
}

func newCachedUploadTestIndex(t *testing.T, be *bleveBackend, key resource.NamespacedResource, rv int64) *bleveIndex {
	t.Helper()
	resourceDir := be.getResourceDir(key)
	require.NoError(t, os.MkdirAll(resourceDir, 0o750))

	idx, err := newBleveIndex(filepath.Join(resourceDir, formatIndexName(time.Now())), bleve.NewIndexMapping(), time.Now(), be.opts.BuildVersion, nil)
	require.NoError(t, err)

	require.NoError(t, idx.Index("dash-1", map[string]string{"title": "Production Overview"}))
	require.NoError(t, setRV(idx, rv))

	wrapped := be.newBleveIndex(key, idx, indexStorageFile, nil, nil, nil, nil, be.log)
	wrapped.resourceVersion.Store(rv)

	be.cacheMx.Lock()
	be.cache[key] = wrapped
	be.cacheMx.Unlock()
	return wrapped
}

func TestSnapshotIndex_CreatesUsableCopy(t *testing.T) {
	be, _ := newTestBleveBackend(t, SnapshotOptions{})
	key := newTestNsResource()
	src := newUploadTestIndex(t, be, key, 42)

	destDir := filepath.Join(t.TempDir(), "snapshot")
	require.NoError(t, be.snapshotIndex(src.index, destDir))

	copied, err := bleve.OpenUsing(destDir, map[string]interface{}{"bolt_timeout": boltTimeout})
	require.NoError(t, err)
	defer func() { _ = copied.Close() }()

	rv, err := getRV(copied)
	require.NoError(t, err)
	assert.Equal(t, int64(42), rv)

	count, err := copied.DocCount()
	require.NoError(t, err)
	assert.Equal(t, uint64(1), count)
}

func TestUploadSnapshot_Success(t *testing.T) {
	store := newHookableStore(t)
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store})
	key := newTestNsResource()
	beforeBuild := time.Now().Add(-time.Second).Truncate(time.Second)
	idx := newUploadTestIndex(t, be, key, 42)

	require.NoError(t, be.uploadSnapshot(context.Background(), key, idx))
	assert.Equal(t, int32(1), store.uploadCalls.Load())
	uploadedMeta := store.getLastUploadedMeta()
	assert.Equal(t, int64(42), uploadedMeta.LatestResourceVersion)
	assert.Equal(t, be.opts.BuildVersion, uploadedMeta.BuildVersion)
	assert.Equal(t, be.opts.BuildVersion, store.getLastLockBuildVersion())
	// BuildTime must be populated from the index's internal build
	// info (set by newBleveIndex), not left zero. Compare with second-level
	// granularity since buildInfo persists Unix seconds.
	assert.False(t, uploadedMeta.BuildTime.IsZero(), "BuildTime should be set")
	assert.False(t, uploadedMeta.BuildTime.Before(beforeBuild),
		"BuildTime %s should be at or after %s", uploadedMeta.BuildTime, beforeBuild)
	assert.NotEmpty(t, store.getLastUploadedFiles())

	snapshotParent := filepath.Join(be.opts.Root, "snapshots", resourceSubPath(key))
	entries, err := os.ReadDir(snapshotParent)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

// TestUploadSnapshot_PreservesOriginalBuildStartTime verifies that periodic
// re-uploads of a long-lived index re-emit the original build-start time
// (carried in the bleve index's internal buildInfo), not the upload time.
func TestUploadSnapshot_PreservesOriginalBuildStartTime(t *testing.T) {
	store := newHookableStore(t)
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store})
	key := newTestNsResource()

	resourceDir := be.getResourceDir(key)
	require.NoError(t, os.MkdirAll(resourceDir, 0o750))

	originalBuildTime := time.Now().Add(-72 * time.Hour).Truncate(time.Second)
	index, err := newBleveIndex(
		filepath.Join(resourceDir, formatIndexName(time.Now())),
		bleve.NewIndexMapping(),
		originalBuildTime,
		be.opts.BuildVersion,
		nil,
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = index.Close() })
	require.NoError(t, index.Index("dash-1", map[string]string{"title": "Production Overview"}))
	require.NoError(t, setRV(index, 42))

	wrapped := be.newBleveIndex(key, index, indexStorageFile, nil, nil, nil, nil, be.log)
	wrapped.resourceVersion.Store(42)

	require.NoError(t, be.uploadSnapshot(context.Background(), key, wrapped))
	require.Equal(t, int32(1), store.uploadCalls.Load())
	assert.Equal(t, originalBuildTime.UTC(), store.getLastUploadedMeta().BuildTime,
		"periodic re-upload should preserve the original build-start time")
}

func TestUploadSnapshot_LockContention(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	err := be.uploadSnapshot(context.Background(), key, idx)
	require.ErrorIs(t, err, errLockHeld)
	assert.Zero(t, store.uploadCalls.Load())
}

func TestUploadSnapshot_UploadErrorCleansStagingDir(t *testing.T) {
	store := newHookableStore(t)
	store.setUploadErr(errors.New("boom"))
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	err := be.uploadSnapshot(context.Background(), key, idx)
	require.Error(t, err)

	snapshotParent := filepath.Join(be.opts.Root, "snapshots", resourceSubPath(key))
	entries, readErr := os.ReadDir(snapshotParent)
	require.NoError(t, readErr)
	assert.Empty(t, entries)
}

func TestRunUploadSnapshots_Success(t *testing.T) {
	store := newHookableStore(t)
	be, metrics := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1})
	key := newTestNsResource()
	idx := newCachedUploadTestIndex(t, be, key, 42)
	require.NoError(t, writeSnapshotMutationCount(idx.index, 3))

	be.runUploadSnapshots(context.Background())

	assert.Equal(t, int32(1), store.uploadCalls.Load())
	trackedAt, ok := be.getUploadTracking(key)
	require.True(t, ok)
	assert.False(t, trackedAt.IsZero())

	count, err := readSnapshotMutationCount(idx.index)
	require.NoError(t, err)
	assert.Zero(t, count)
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))

	m := &dto.Metric{}
	require.NoError(t, metrics.IndexSnapshotUploadDuration.Write(m))
	assert.Equal(t, uint64(1), m.GetHistogram().GetSampleCount())
}

func TestRunUploadSnapshots_SkipNoChanges(t *testing.T) {
	store := newHookableStore(t)
	be, metrics := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 10})
	key := newTestNsResource()
	idx := newCachedUploadTestIndex(t, be, key, 42)
	require.NoError(t, writeSnapshotMutationCount(idx.index, 5))
	be.setUploadTracking(key, time.Now().Add(-2*time.Hour))

	be.runUploadSnapshots(context.Background())

	assert.Zero(t, store.uploadCalls.Load())
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSkipNoChanges)))
}

func TestRunUploadSnapshots_OwnershipCheck(t *testing.T) {
	tests := []struct {
		name         string
		ownsIndexFn  func(resource.NamespacedResource) (bool, error)
		wantStatus   string
		probeMessage string
	}{
		{
			name:         "skip not owner",
			ownsIndexFn:  func(resource.NamespacedResource) (bool, error) { return false, nil },
			wantStatus:   snapshotUploadStatusSkipNotOwner,
			probeMessage: "remote probe must not run for non-owned indexes",
		},
		{
			name:         "ownership check error",
			ownsIndexFn:  func(resource.NamespacedResource) (bool, error) { return false, errors.New("ring unavailable") },
			wantStatus:   snapshotUploadStatusError,
			probeMessage: "remote probe must not run when ownership check fails",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newHookableStore(t)
			be, metrics := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1})
			key := newTestNsResource()
			idx := newCachedUploadTestIndex(t, be, key, 42)
			require.NoError(t, writeSnapshotMutationCount(idx.index, 5))
			be.ownsIndexFn = tt.ownsIndexFn

			be.runUploadSnapshots(t.Context())

			assert.Zero(t, store.uploadCalls.Load())
			assert.Zero(t, store.listKeyCalls.Load(), tt.probeMessage)
			assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(tt.wantStatus)))
		})
	}
}

func TestRunUploadSnapshots_SkipLockContention(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	be, metrics := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1})
	key := newTestNsResource()
	idx := newCachedUploadTestIndex(t, be, key, 42)
	require.NoError(t, writeSnapshotMutationCount(idx.index, 5))
	be.setUploadTracking(key, time.Now().Add(-2*time.Hour))

	be.runUploadSnapshots(context.Background())

	assert.Zero(t, store.uploadCalls.Load())
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSkipLockHeld)))
}

func TestRunUploadSnapshots_PreservesConcurrentMutations(t *testing.T) {
	store := newHookableStore(t)
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1})
	key := newTestNsResource()
	idx := newCachedUploadTestIndex(t, be, key, 42)
	require.NoError(t, writeSnapshotMutationCount(idx.index, 3))
	store.setOnUpload(func() error {
		return idx.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				Name:  "dash-2",
				Title: "dash-2",
				Key: &resourcepb.ResourceKey{
					Name:      "dash-2",
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				},
			},
		}}})
	})

	be.runUploadSnapshots(context.Background())

	count, err := readSnapshotMutationCount(idx.index)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}

// --- cross-instance upload-time dedup ---

// TestUploadSnapshot_SkipsWhenRecentSameVersionRemoteExists verifies that the
// upload-time probe short-circuits the upload path when a same-version remote
// snapshot exists within UploadInterval. The lock must not be acquired and no
// upload must happen.
func TestUploadSnapshot_SkipsWhenRecentSameVersionRemoteExists(t *testing.T) {
	store := newHookableStore(t)
	recent := makeULID(t, time.Now().Add(-5*time.Minute))
	key := newTestNsResource()
	seedSnapshot(t, context.Background(), store.bucket, key, recent, &IndexMeta{BuildVersion: "11.5.0"})

	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store, UploadInterval: time.Hour})
	idx := newUploadTestIndex(t, be, key, 42)

	err := be.uploadSnapshot(t.Context(), key, idx)
	require.ErrorIs(t, err, errSkipRecentRemote)
	assert.Zero(t, store.uploadCalls.Load(), "upload must not happen on probe hit")
	// The probe must run, and the lock must NOT be acquired (lockErr is unset
	// here, so we can only assert via uploadCalls; LockBuildIndex is implicitly
	// not exercised because no upload path runs).
	assert.Equal(t, int32(1), store.listKeyCalls.Load())
	assert.Equal(t, int32(1), store.readManifestCalls.Load())
}

// TestUploadSnapshot_ProceedsWhenRemoteIsDifferentVersion verifies that the
// probe does not skip when only different-version snapshots are present.
func TestUploadSnapshot_ProceedsWhenRemoteIsDifferentVersion(t *testing.T) {
	store := newHookableStore(t)
	recent := makeULID(t, time.Now().Add(-5*time.Minute))
	key := newTestNsResource()
	seedSnapshot(t, context.Background(), store.bucket, key, recent, &IndexMeta{BuildVersion: "11.4.0"})

	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store, UploadInterval: time.Hour})
	idx := newUploadTestIndex(t, be, key, 42)

	require.NoError(t, be.uploadSnapshot(t.Context(), key, idx))
	assert.Equal(t, int32(1), store.uploadCalls.Load())
}

// TestUploadSnapshot_ProceedsWhenProbeErrors verifies that the probe is an
// optimisation, not a correctness check: a probe failure must not block the
// upload path.
func TestUploadSnapshot_ProceedsWhenProbeErrors(t *testing.T) {
	store := newHookableStore(t)
	store.setListKeysErr(errors.New("transport boom"))
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store, UploadInterval: time.Hour})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	require.NoError(t, be.uploadSnapshot(t.Context(), key, idx))
	assert.Equal(t, int32(1), store.uploadCalls.Load())
}

// TestUploadSnapshot_SkipsProbeWhenUploadIntervalZero verifies that the probe
// is gated on UploadInterval > 0, mirroring the local lastUploadTime logic.
func TestUploadSnapshot_SkipsProbeWhenUploadIntervalZero(t *testing.T) {
	store := newHookableStore(t)
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store /* UploadInterval omitted (0) */})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	require.NoError(t, be.uploadSnapshot(t.Context(), key, idx))
	assert.Zero(t, store.listKeyCalls.Load(), "probe must not be called when UploadInterval == 0")
	assert.Equal(t, int32(1), store.uploadCalls.Load())
}

// TestRunUploadSnapshots_SkipRecentRemote verifies the periodic loop's
// handling of errSkipRecentRemote: lastUploadTime is bumped to ~now, the
// skip_recent_remote metric is incremented, and the mutation baseline is
// preserved (no snapshot was actually taken).
func TestRunUploadSnapshots_SkipRecentRemote(t *testing.T) {
	store := newHookableStore(t)
	recent := makeULID(t, time.Now().Add(-5*time.Minute))
	key := newTestNsResource()
	seedSnapshot(t, context.Background(), store.bucket, key, recent, &IndexMeta{BuildVersion: "11.5.0"})

	be, metrics := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1})
	idx := newCachedUploadTestIndex(t, be, key, 42)
	require.NoError(t, writeSnapshotMutationCount(idx.index, 5))

	before := time.Now()
	be.runUploadSnapshots(t.Context())

	assert.Zero(t, store.uploadCalls.Load(), "upload must not happen on probe hit")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSkipRecentRemote)))

	// lastUploadTime should be advanced to ~now (rate-limits this replica's
	// probes to once per UploadInterval).
	trackedAt, ok := be.getUploadTracking(key)
	require.True(t, ok)
	assert.False(t, trackedAt.Before(before), "lastUploadTime should be bumped to >= probe start time")

	// Mutation baseline must be preserved: no snapshot was actually taken, so
	// the next eligible upload should still see these mutations.
	count, err := readSnapshotMutationCount(idx.index)
	require.NoError(t, err)
	assert.Equal(t, int64(5), count)
}

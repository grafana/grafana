package search

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/oklog/ulid/v2"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type uploadTestStore struct {
	lockErr error

	uploadErr   error
	uploadCalls atomic.Int32
	uploadMeta  IndexMeta
	uploaded    []string
	onUpload    func() error
}

func (s *uploadTestStore) LockBuildIndex(context.Context, resource.NamespacedResource) (IndexStoreLock, error) {
	if s.lockErr != nil {
		return nil, s.lockErr
	}
	return &noopIndexStoreLock{lost: make(chan struct{})}, nil
}

func (s *uploadTestStore) UploadIndex(_ context.Context, _ resource.NamespacedResource, localDir string, meta IndexMeta) (ulid.ULID, error) {
	s.uploadCalls.Add(1)
	s.uploadMeta = meta

	err := filepath.WalkDir(localDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(localDir, path)
		if err != nil {
			return err
		}
		s.uploaded = append(s.uploaded, filepath.ToSlash(rel))
		return nil
	})
	if err != nil {
		return ulid.ULID{}, err
	}
	if s.onUpload != nil {
		if err := s.onUpload(); err != nil {
			return ulid.ULID{}, err
		}
	}
	if s.uploadErr != nil {
		return ulid.ULID{}, s.uploadErr
	}
	return ulid.Make(), nil
}

func (s *uploadTestStore) DownloadIndex(context.Context, resource.NamespacedResource, ulid.ULID, string) (*IndexMeta, error) {
	panic("DownloadIndex not implemented for uploadTestStore")
}

func (s *uploadTestStore) ListIndexes(context.Context, resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error) {
	panic("ListIndexes not implemented for uploadTestStore")
}

func (s *uploadTestStore) DeleteIndex(context.Context, resource.NamespacedResource, ulid.ULID) error {
	panic("DeleteIndex not implemented for uploadTestStore")
}

func (s *uploadTestStore) CleanupIncompleteUploads(context.Context, resource.NamespacedResource, time.Duration) (int, error) {
	panic("CleanupIncompleteUploads not implemented for uploadTestStore")
}

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
	store := &uploadTestStore{}
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	require.NoError(t, be.uploadSnapshot(context.Background(), key, idx))
	assert.Equal(t, int32(1), store.uploadCalls.Load())
	assert.Equal(t, int64(42), store.uploadMeta.LatestResourceVersion)
	assert.Equal(t, be.opts.BuildVersion, store.uploadMeta.GrafanaBuildVersion)
	assert.NotEmpty(t, store.uploaded)

	snapshotParent := filepath.Join(be.opts.Root, "snapshots", resourceSubPath(key))
	entries, err := os.ReadDir(snapshotParent)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

func TestUploadSnapshot_LockContention(t *testing.T) {
	store := &uploadTestStore{lockErr: errLockHeld}
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	err := be.uploadSnapshot(context.Background(), key, idx)
	require.ErrorIs(t, err, errLockHeld)
	assert.Zero(t, store.uploadCalls.Load())
}

func TestUploadSnapshot_UploadErrorCleansStagingDir(t *testing.T) {
	store := &uploadTestStore{uploadErr: errors.New("boom")}
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
	store := &uploadTestStore{}
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
	store := &uploadTestStore{}
	be, metrics := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 10})
	key := newTestNsResource()
	idx := newCachedUploadTestIndex(t, be, key, 42)
	require.NoError(t, writeSnapshotMutationCount(idx.index, 5))
	be.setUploadTracking(key, time.Now().Add(-2*time.Hour))

	be.runUploadSnapshots(context.Background())

	assert.Zero(t, store.uploadCalls.Load())
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSkipNoChanges)))
}

func TestRunUploadSnapshots_SkipLockContention(t *testing.T) {
	store := &uploadTestStore{lockErr: errLockHeld}
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
	store := &uploadTestStore{}
	be, _ := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1})
	key := newTestNsResource()
	idx := newCachedUploadTestIndex(t, be, key, 42)
	require.NoError(t, writeSnapshotMutationCount(idx.index, 3))
	store.onUpload = func() error {
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
	}

	be.runUploadSnapshots(context.Background())

	count, err := readSnapshotMutationCount(idx.index)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}

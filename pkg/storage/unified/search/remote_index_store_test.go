package search

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/oklog/ulid/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"
	_ "gocloud.dev/blob/azureblob"
	"gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/gcsblob"
	"gocloud.dev/blob/memblob"
	_ "gocloud.dev/blob/s3blob"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// testLogger is the logger passed to package-level helpers from tests. Tests
// generally don't assert on log output, so a single shared logger is fine.
var testLogger = log.New("remote-index-test")

// testBucket returns a bucket for testing. Uses CDK_TEST_BUCKET_URL if set,
// otherwise falls back to a local fileblob.
//
//	CDK_TEST_BUCKET_URL=gs://my-test-bucket go test ./pkg/storage/unified/search/... -v
func testBucket(t *testing.T) *blob.Bucket {
	t.Helper()
	if bucketURL := os.Getenv("CDK_TEST_BUCKET_URL"); bucketURL != "" {
		b, err := blob.OpenBucket(context.Background(), bucketURL)
		require.NoError(t, err)
		t.Cleanup(func() { _ = b.Close() })
		return b
	}
	dir := t.TempDir()
	b, err := fileblob.OpenBucket(dir, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = b.Close() })
	return b
}

func newTestNsResource() resource.NamespacedResource {
	return resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
}

func newTestRemoteIndexStore(t *testing.T, bucket resource.CDKBucket) *BucketRemoteIndexStore {
	t.Helper()
	return newTestRemoteIndexStoreWithLockOwner(t, bucket, newFakeBackend(newConditionalBucket()), "test-owner")
}

func newTestRemoteIndexStoreWithLockOwner(t *testing.T, bucket resource.CDKBucket, backend lockBackend, owner string) *BucketRemoteIndexStore {
	t.Helper()
	opts := LockOptions{TTL: 5 * time.Second, HeartbeatInterval: 500 * time.Millisecond}
	return NewBucketRemoteIndexStore(BucketRemoteIndexStoreConfig{
		Bucket:      bucket,
		LockBackend: backend,
		LockOwner:   owner,
		BuildLock:   opts,
		CleanupLock: opts,
	})
}

// createTestBleveIndex creates a real bleve index with sample documents.
func createTestBleveIndex(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "bleve-index")
	idx, err := bleve.New(dir, bleve.NewIndexMapping())
	require.NoError(t, err)

	for id, doc := range map[string]map[string]string{
		"dash-1": {"title": "Production Overview", "folder": "ops"},
		"dash-2": {"title": "API Latency", "folder": "ops"},
		"dash-3": {"title": "Frontend Errors", "folder": "frontend"},
	} {
		require.NoError(t, idx.Index(id, doc))
	}
	require.NoError(t, idx.Close())
	return dir
}

func TestRemoteIndexStore_UploadDownloadBleveIndex(t *testing.T) {
	store := newTestRemoteIndexStore(t, testBucket(t))
	ctx := context.Background()
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
	assert.True(t, gotMeta.BuildTime.Equal(buildStart),
		"BuildTime should round-trip: got %s, want %s", gotMeta.BuildTime, buildStart)

	// ListIndexSnapshots must surface the same value.
	listed, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	require.Contains(t, listed, indexKey)
	assert.True(t, listed[indexKey].BuildTime.Equal(buildStart),
		"BuildTime should round-trip via ListIndexSnapshots: got %s, want %s",
		listed[indexKey].BuildTime, buildStart)

	// Open and query the downloaded index
	idx, err := bleve.Open(destDir)
	require.NoError(t, err)

	count, err := idx.DocCount()
	require.NoError(t, err)
	assert.Equal(t, uint64(3), count)

	result, err := idx.Search(bleve.NewSearchRequest(bleve.NewMatchQuery("Production")))
	require.NoError(t, err)
	assert.Equal(t, uint64(1), result.Total)
	assert.Equal(t, "dash-1", result.Hits[0].ID)

	result2, err := idx.Search(bleve.NewSearchRequest(bleve.NewMatchQuery("ops")))
	require.NoError(t, err)
	assert.Equal(t, uint64(2), result2.Total)

	require.NoError(t, idx.Close())
}

// TestRemoteIndexStore_ListIndexes_LegacyMetaWithoutBuildStartTime verifies
// that a snapshot manifest produced before the BuildTime field was
// introduced is still accepted by ListIndexSnapshots and surfaces a zero-value
// BuildTime. Readers must treat zero as "unknown".
func TestRemoteIndexStore_ListIndexes_LegacyMetaWithoutBuildStartTime(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()
	indexKey := ulid.Make()

	// Hand-crafted manifest with no build_time field at all,
	// mirroring the on-disk shape of legacy snapshots.
	legacyManifest := []byte(`{
		"build_version": "11.0.0",
		"upload_timestamp": "2024-01-01T00:00:00Z",
		"latest_resource_version": 42,
		"files": {"store/root.bolt": 1}
	}`)
	pfx := indexPrefix(ns, indexKey.String())
	require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, legacyManifest, nil))

	listed, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	require.Contains(t, listed, indexKey)
	assert.True(t, listed[indexKey].BuildTime.IsZero(),
		"legacy manifest should decode to zero-valued BuildTime, got %s",
		listed[indexKey].BuildTime)
	assert.Equal(t, "11.0.0", listed[indexKey].BuildVersion)
	assert.Equal(t, int64(42), listed[indexKey].LatestResourceVersion)
}

func TestRemoteIndexStore_ListAndDeleteIndexes(t *testing.T) {
	store := newTestRemoteIndexStore(t, testBucket(t))
	ctx := context.Background()
	ns := newTestNsResource()

	keys := make([]ulid.ULID, 0, 3)
	for range 3 {
		srcDir := createTestBleveIndex(t)
		meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
		key, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
		require.NoError(t, err)
		keys = append(keys, key)
		t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, key) })
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

	// Download of a deleted index should fail
	_, err = DownloadIndexSnapshot(ctx, store, ns, keys[0], filepath.Join(t.TempDir(), "dl"))
	require.Error(t, err)
}

func TestValidateIndexSnapshotManifest(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]int64
		wantErr string
	}{
		{name: "valid paths", files: map[string]int64{"store/root.bolt": 100, "store/00001.zap": 200}},
		{name: "leading double-dot in filename", files: map[string]int64{"..foo/bar.zap": 100}},
		{name: "empty file list", files: map[string]int64{}, wantErr: "empty file manifest"},
		{name: "path traversal", files: map[string]int64{"../../../tmp/escape": 100}, wantErr: "invalid path"},
		{name: "absolute path", files: map[string]int64{"/tmp/escape": 100}, wantErr: "invalid path"},
		{name: "non-canonical dotslash", files: map[string]int64{"./store/root.bolt": 100}, wantErr: "non-canonical"},
		{name: "non-canonical double dot", files: map[string]int64{"store/../store/root.bolt": 100}, wantErr: "non-canonical"},
		{name: "dot entry", files: map[string]int64{".": 100}, wantErr: "invalid path"},
		{name: "parent dir entry", files: map[string]int64{"..": 100}, wantErr: "invalid path"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateIndexSnapshotManifest(&IndexMeta{Files: tt.files})
			if tt.wantErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.ErrorIs(t, err, ErrInvalidManifest)
				require.Contains(t, err.Error(), tt.wantErr)
			}
		})
	}
}

// --- memblob-only tests (require direct bucket manipulation) ---

func TestRemoteIndexStore_UploadRejectsNonRegularFiles(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)

	// Add a symlink into the bleve index directory
	externalFile := filepath.Join(t.TempDir(), "secret.txt")
	require.NoError(t, os.WriteFile(externalFile, []byte("secret"), 0600))
	require.NoError(t, os.Symlink(externalFile, filepath.Join(srcDir, "sneaky.zap")))

	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrNonRegularFile)
}

func TestRemoteIndexStore_DownloadRejectsCorruptMetaJSON(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()
	key := ulid.Make()
	pfx := indexPrefix(ns, key.String())

	t.Run("missing snapshot manifest", func(t *testing.T) {
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.ErrorIs(t, err, ErrSnapshotNotFound)
	})

	t.Run("invalid JSON", func(t *testing.T) {
		require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, []byte("{not json"), nil))
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "parsing snapshot manifest")
	})

	t.Run("empty file manifest", func(t *testing.T) {
		meta := IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{}}
		metaBytes, err := json.Marshal(meta)
		require.NoError(t, err)
		require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, metaBytes, nil))
		_, err = DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "empty file manifest")
	})

	t.Run("non-canonical path", func(t *testing.T) {
		meta := IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{"store/../store/root.bolt": 100}}
		metaBytes, err := json.Marshal(meta)
		require.NoError(t, err)
		require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, metaBytes, nil))
		_, err = DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "non-canonical")
	})

	t.Run("absolute path", func(t *testing.T) {
		meta := IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{"/etc/passwd": 100}}
		metaBytes, err := json.Marshal(meta)
		require.NoError(t, err)
		require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, metaBytes, nil))
		_, err = DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid")
	})

	t.Run("oversized snapshot manifest", func(t *testing.T) {
		// Write a manifest that exceeds the 1 MiB limit
		oversized := make([]byte, maxSnapshotManifestSize+1)
		for i := range oversized {
			oversized[i] = 'x'
		}
		require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, oversized, nil))
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, filepath.Join(t.TempDir(), "dl"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "write limit exceeded")
	})
}

func TestRemoteIndexStore_DownloadRejectsOversizedFile(t *testing.T) {
	// A bucket object that exceeds the size advertised in the snapshot manifest
	// must fail fast — we should not transfer unbounded bytes to disk before
	// noticing.
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()
	key := ulid.Make()
	pfx := indexPrefix(ns, key.String())

	const advertised = 10
	meta := IndexMeta{
		BuildVersion: "11.0.0",
		Files:        map[string]int64{"store/root.bolt": advertised},
	}
	metaBytes, err := json.Marshal(meta)
	require.NoError(t, err)
	require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, metaBytes, nil))

	// Plant a file far larger than what the snapshot manifest claims.
	oversized := bytes.Repeat([]byte("x"), advertised*1000)
	require.NoError(t, bucket.WriteAll(ctx, pfx+"store/root.bolt", oversized, nil))

	_, err = DownloadIndexSnapshot(ctx, store, ns, key, filepath.Join(t.TempDir(), "dl"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "exceeds expected size")
}

func TestRemoteIndexStore_DownloadValidatesCompleteness(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	indexKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	// Delete one file from the bucket to simulate partial upload
	pfx := indexPrefix(ns, indexKey.String())
	metaRaw, err := bucket.ReadAll(ctx, pfx+snapshotManifestFile)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(metaRaw, &meta))
	for relPath := range meta.Files {
		require.NoError(t, bucket.Delete(ctx, pfx+relPath))
		break
	}

	_, err = DownloadIndexSnapshot(ctx, store, ns, indexKey, filepath.Join(t.TempDir(), "dl"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "not found")
}

func TestRemoteIndexStore_UploadRejectsEmptyDirectory(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	emptyDir := t.TempDir()
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := UploadIndexSnapshot(ctx, store, ns, emptyDir, meta, testLogger)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no files to upload")
}

func TestRemoteIndexStore_UploadExcludesMetaJSON(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	// Plant a stale snapshot manifest in the source directory
	require.NoError(t, os.WriteFile(filepath.Join(srcDir, snapshotManifestFile), []byte(`{"stale":"data"}`), 0600))

	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	indexKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	pfx := indexPrefix(ns, indexKey.String())
	metaBytes, err := bucket.ReadAll(ctx, pfx+snapshotManifestFile)
	require.NoError(t, err)
	var uploaded IndexMeta
	require.NoError(t, json.Unmarshal(metaBytes, &uploaded))
	require.NotContains(t, uploaded.Files, snapshotManifestFile)
}

// --- Error injection tests (memblob + errorBucket) ---

type errorBucket struct {
	resource.CDKBucket
	uploadErr         error
	manifestUploadErr error // fires on Upload only when key is the snapshot manifest object
	downloadErr       error
	downloadFn        func(key string) error // if set, called instead of downloadErr
	deleteErr         error
}

func (e *errorBucket) Upload(ctx context.Context, key string, r io.Reader, opts *blob.WriterOptions) error {
	if e.uploadErr != nil {
		return e.uploadErr
	}
	if e.manifestUploadErr != nil && strings.HasSuffix(key, "/"+snapshotManifestFile) {
		return e.manifestUploadErr
	}
	return e.CDKBucket.Upload(ctx, key, r, opts)
}

func (e *errorBucket) Download(ctx context.Context, key string, w io.Writer, opts *blob.ReaderOptions) error {
	if e.downloadFn != nil {
		if err := e.downloadFn(key); err != nil {
			return err
		}
	} else if e.downloadErr != nil {
		return e.downloadErr
	}
	return e.CDKBucket.Download(ctx, key, w, opts)
}

func (e *errorBucket) Delete(ctx context.Context, key string) error {
	if e.deleteErr != nil {
		return e.deleteErr
	}
	return e.CDKBucket.Delete(ctx, key)
}

func TestRemoteIndexStore_BucketErrors(t *testing.T) {
	ctx := context.Background()
	ns := newTestNsResource()

	uploadSnapshot := func(t *testing.T, bucket *blob.Bucket) ulid.ULID {
		t.Helper()
		store := newTestRemoteIndexStore(t, bucket)
		srcDir := createTestBleveIndex(t)
		meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
		key, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
		require.NoError(t, err)
		return key
	}

	t.Run("upload file error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := newTestRemoteIndexStore(t, &errorBucket{CDKBucket: real, uploadErr: fmt.Errorf("upload network timeout")})

		_, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}, testLogger)
		require.Error(t, err)
		require.Contains(t, err.Error(), "upload network timeout")
	})

	t.Run("snapshot manifest write error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := newTestRemoteIndexStore(t, &errorBucket{CDKBucket: real, manifestUploadErr: fmt.Errorf("write quota exceeded")})

		_, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}, testLogger)
		require.Error(t, err)
		require.Contains(t, err.Error(), "write quota exceeded")
	})

	t.Run("snapshot manifest download error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := newTestRemoteIndexStore(t, &errorBucket{
			CDKBucket: real,
			downloadFn: func(key string) error {
				if strings.HasSuffix(key, "/"+snapshotManifestFile) {
					return fmt.Errorf("access denied")
				}
				return nil
			},
		})

		_, err := DownloadIndexSnapshot(ctx, store, ns, ulid.Make(), filepath.Join(t.TempDir(), "dl"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "access denied")
	})

	t.Run("file download error cleans up staging dir", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		key := uploadSnapshot(t, real)
		store := newTestRemoteIndexStore(t, &errorBucket{CDKBucket: real, downloadErr: fmt.Errorf("connection reset")})

		parentDir := t.TempDir()
		destDir := filepath.Join(parentDir, "downloaded")
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "connection reset")

		// destDir should not exist (staging dir cleaned up, rename never happened)
		_, statErr := os.Stat(destDir)
		require.True(t, os.IsNotExist(statErr), "dest dir should not exist after failure")

		// Parent should still exist and have no leftover staging dirs
		entries, err := os.ReadDir(parentDir)
		require.NoError(t, err)
		assert.Empty(t, entries, "no staging dirs should remain in parent")
	})

	t.Run("download fails if dest already exists", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		key := uploadSnapshot(t, real)
		store := newTestRemoteIndexStore(t, real)

		destDir := t.TempDir() // already exists
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "destination already exists")
	})

	t.Run("delete error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		key := uploadSnapshot(t, real)
		store := newTestRemoteIndexStore(t, &errorBucket{CDKBucket: real, deleteErr: fmt.Errorf("permission denied")})

		err := store.DeleteIndex(ctx, ns, key)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})
}

func TestRemoteIndexStore_CleanupIncompleteIndexSnapshots(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	// Upload a complete index (has a snapshot manifest)
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	completeKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	// Simulate an incomplete upload: write objects under a ULID prefix without a snapshot manifest
	incompleteKey := ulid.Make()
	incompletePfx := indexPrefix(ns, incompleteKey.String())
	require.NoError(t, bucket.WriteAll(ctx, incompletePfx+"store/root.bolt", []byte("orphaned"), nil))
	require.NoError(t, bucket.WriteAll(ctx, incompletePfx+"store/00000001.zap", []byte("orphaned"), nil))

	// Cleanup should remove only the incomplete prefix
	cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now(), testLogger)
	require.NoError(t, err)
	assert.Equal(t, 1, cleaned)

	// Complete index should still be intact
	indexes, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	assert.Contains(t, indexes, completeKey)

	// Incomplete prefix should be gone
	iter := bucket.List(&blob.ListOptions{Prefix: incompletePfx})
	obj, err := iter.Next(ctx)
	assert.Nil(t, obj)
	assert.ErrorIs(t, err, io.EOF)
}

func TestRemoteIndexStore_CleanupIncompleteIndexSnapshots_NoneFound(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	// Upload a complete index
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	// Nothing to clean
	cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now(), testLogger)
	require.NoError(t, err)
	assert.Equal(t, 0, cleaned)
}

func TestRemoteIndexStore_CleanupIncompleteIndexSnapshots_CorruptManifest(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	// Upload a valid complete index
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	completeKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	t.Run("invalid JSON manifest", func(t *testing.T) {
		key := ulid.Make()
		pfx := indexPrefix(ns, key.String())
		require.NoError(t, bucket.WriteAll(ctx, pfx+"store/root.bolt", []byte("data"), nil))
		require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, []byte("{corrupt"), nil))

		cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now(), testLogger)
		require.NoError(t, err)
		assert.Equal(t, 1, cleaned)
	})

	t.Run("empty files manifest", func(t *testing.T) {
		key := ulid.Make()
		pfx := indexPrefix(ns, key.String())
		require.NoError(t, bucket.WriteAll(ctx, pfx+"store/root.bolt", []byte("data"), nil))
		emptyMeta, _ := json.Marshal(IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{}})
		require.NoError(t, bucket.WriteAll(ctx, pfx+snapshotManifestFile, emptyMeta, nil))

		cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now(), testLogger)
		require.NoError(t, err)
		assert.Equal(t, 1, cleaned)
	})

	// Complete index should still be intact after all cleanups
	indexes, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	assert.Contains(t, indexes, completeKey)
}

func TestRemoteIndexStore_CleanupIncompleteIndexSnapshots_MinAge(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	// Create an incomplete prefix with a ULID from 2 hours ago.
	oldKey, err := ulid.New(ulid.Timestamp(time.Now().Add(-2*time.Hour)), rand.Reader)
	require.NoError(t, err)
	oldPfx := indexPrefix(ns, oldKey.String())
	require.NoError(t, bucket.WriteAll(ctx, oldPfx+"store/root.bolt", []byte("old"), nil))

	// Create an incomplete prefix with a recent ULID (now).
	recentKey := ulid.Make()
	recentPfx := indexPrefix(ns, recentKey.String())
	require.NoError(t, bucket.WriteAll(ctx, recentPfx+"store/root.bolt", []byte("recent"), nil))

	// Cleanup with a cutoff of 1h ago should only delete the old prefix.
	cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now().Add(-time.Hour), testLogger)
	require.NoError(t, err)
	assert.Equal(t, 1, cleaned)

	// Old prefix should be gone.
	iter := bucket.List(&blob.ListOptions{Prefix: oldPfx})
	obj, err := iter.Next(ctx)
	assert.Nil(t, obj)
	assert.ErrorIs(t, err, io.EOF)

	// Recent prefix should still exist.
	iter = bucket.List(&blob.ListOptions{Prefix: recentPfx})
	obj, err = iter.Next(ctx)
	require.NoError(t, err)
	assert.NotNil(t, obj)
}

func TestRemoteIndexStore_LockBuildIndex_AcquireRelease(t *testing.T) {
	ctx := context.Background()
	ns := newTestNsResource()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")

	lock, err := store.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)

	select {
	case <-lock.Lost():
		t.Fatal("lock should not be lost")
	default:
	}

	require.NoError(t, lock.Release())
}

func TestRemoteIndexStore_LockBuildIndex_Contention(t *testing.T) {
	ctx := context.Background()
	ns := newTestNsResource()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()

	store1 := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")
	store2 := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-2")

	lock1, err := store1.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = lock1.Release() })

	_, err = store2.LockBuildIndex(ctx, ns, "11.5.0")
	require.ErrorIs(t, err, errLockHeld)

	require.NoError(t, lock1.Release())
	lock2, err := store2.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	require.NoError(t, lock2.Release())
}

func TestRemoteIndexStore_LockBuildIndex_VersionScoped(t *testing.T) {
	ctx := context.Background()
	ns := newTestNsResource()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()

	store1 := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")
	store2 := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-2")

	lock1, err := store1.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = lock1.Release() })

	lock2, err := store2.LockBuildIndex(ctx, ns, "11.6.0")
	require.NoError(t, err)
	require.NoError(t, lock2.Release())
}

func TestRemoteIndexStore_LockBuildIndex_RequiresBuildVersion(t *testing.T) {
	ctx := context.Background()
	ns := newTestNsResource()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")

	lock, err := store.LockBuildIndex(ctx, ns, "")
	require.Error(t, err)
	assert.Nil(t, lock)
}

func TestRemoteIndexStore_LockBuildIndex_KeyEncodesBuildVersion(t *testing.T) {
	ns := newTestNsResource()
	key := buildIndexLockKey(ns, "v11.5.0+security/branch")
	segment := strings.TrimPrefix(key, resourceSubPath(ns)+"/locks/build-")

	require.NoError(t, validateObjectKey(key))
	assert.NotEmpty(t, segment)
	assert.NotContains(t, segment, "/")
}

func TestRemoteIndexStore_LockBuildIndex_LostAndReleaseAfterLoss(t *testing.T) {
	ctx := context.Background()
	ns := newTestNsResource()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")

	lock, err := store.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)

	require.NoError(t, backend.Delete(ctx, buildIndexLockKey(ns, "11.5.0"), "instance-1"))

	select {
	case <-lock.Lost():
	case <-time.After(2 * time.Second):
		t.Fatal("expected lock loss to be detected")
	}

	err = lock.Release()
	require.True(t, err == nil || errors.Is(err, errLockNotFound), "expected nil or errLockNotFound, got %v", err)
	require.NoError(t, lock.Release())
}

// --- ListNamespaces / ListNamespaceIndexes / LockNamespaceForCleanup ---

func TestRemoteIndexStore_ListNamespaces_Empty(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)

	got, err := store.ListNamespaces(ctx)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestRemoteIndexStore_ListNamespaces(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)

	// Seed snapshots in three distinct namespaces.
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

func TestRemoteIndexStore_ListNamespaces_IgnoresStrayObjects(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)

	// A bare object at the bucket root must not be reported as a namespace.
	require.NoError(t, bucket.WriteAll(ctx, "stray.txt", []byte("hi"), nil))

	nsRes := resource.NamespacedResource{Namespace: "stack-1", Group: "dashboard.grafana.app", Resource: "dashboards"}
	_, err := UploadIndexSnapshot(ctx, store, nsRes, createTestBleveIndex(t),
		IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 1}, testLogger)
	require.NoError(t, err)

	got, err := store.ListNamespaces(ctx)
	require.NoError(t, err)
	assert.Equal(t, []string{"stack-1"}, got)
}

func TestRemoteIndexStore_ListNamespaceIndexes(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)

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

func TestRemoteIndexStore_ListNamespaceIndexes_Empty(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)

	got, err := store.ListNamespaceResources(ctx, "stack-1")
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestRemoteIndexStore_ListIndexes_SkipsLockSibling(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)
	ns := newTestNsResource()

	indexKey, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
		IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 1}, testLogger)
	require.NoError(t, err)

	// Plant a `<resource-group>/locks/build-<version>` object directly in the data bucket.
	// In production the lock backend shares the snapshot bucket, so this prefix
	// is observable alongside index-key directories. ListIndexSnapshots must skip it.
	require.NoError(t, bucket.WriteAll(ctx, buildIndexLockKey(ns, "11.0.0"), []byte("{}"), nil))

	indexes, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	require.Len(t, indexes, 1)
	assert.Contains(t, indexes, indexKey)
}

func TestRemoteIndexStore_ListNamespaceIndexes_SkipsLockSibling(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStore(t, bucket)

	nsRes := resource.NamespacedResource{Namespace: "stack-1", Group: "dashboard.grafana.app", Resource: "dashboards"}
	_, err := UploadIndexSnapshot(ctx, store, nsRes, createTestBleveIndex(t),
		IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 1}, testLogger)
	require.NoError(t, err)

	// Plant a `stack-1/locks/...` object directly in the data bucket. In production
	// the lock backend shares the snapshot bucket, so this prefix is observable
	// alongside resource directories. ListNamespaceIndexes must skip it.
	require.NoError(t, bucket.WriteAll(ctx, "stack-1/locks/cleanup", []byte("{}"), nil))

	got, err := store.ListNamespaceResources(ctx, "stack-1")
	require.NoError(t, err)
	assert.Equal(t, []resource.NamespacedResource{nsRes}, got)
}

func TestRemoteIndexStore_LockNamespaceForCleanup_AcquireRelease(t *testing.T) {
	ctx := context.Background()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")

	lock, err := store.LockNamespaceForCleanup(ctx, "stack-1")
	require.NoError(t, err)
	select {
	case <-lock.Lost():
		t.Fatal("lock should not be lost")
	default:
	}
	require.NoError(t, lock.Release())
}

func TestRemoteIndexStore_LockNamespaceForCleanup_Contention(t *testing.T) {
	ctx := context.Background()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()

	store1 := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")
	store2 := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-2")

	lock1, err := store1.LockNamespaceForCleanup(ctx, "stack-1")
	require.NoError(t, err)
	t.Cleanup(func() { _ = lock1.Release() })

	_, err = store2.LockNamespaceForCleanup(ctx, "stack-1")
	require.ErrorIs(t, err, errLockHeld)

	// Different namespace must be acquirable independently.
	lock2, err := store2.LockNamespaceForCleanup(ctx, "stack-2")
	require.NoError(t, err)
	require.NoError(t, lock2.Release())

	require.NoError(t, lock1.Release())
}

func TestRemoteIndexStore_LockNamespaceForCleanup_DistinctFromBuildLock(t *testing.T) {
	// The cleanup lock must not block the build lock for a resource in the same namespace,
	// nor vice versa. Both are independently acquirable.
	ctx := context.Background()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := newTestRemoteIndexStoreWithLockOwner(t, bucket, backend, "instance-1")
	ns := newTestNsResource()

	cleanupLock, err := store.LockNamespaceForCleanup(ctx, ns.Namespace)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cleanupLock.Release() })

	buildLock, err := store.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	require.NoError(t, buildLock.Release())

	require.NotEqual(t, cleanupLockKey(ns.Namespace), buildIndexLockKey(ns, "11.5.0"))
}

// Smoke-tests the LockOptions plumbing. Only TTL is observable in lockInfo;
// HeartbeatUpdateTimeout behaviour is covered separately on objectStorageLock.
func TestRemoteIndexStore_BuildAndCleanupLockTTLsWiredIndependently(t *testing.T) {
	ctx := context.Background()
	backend := newFakeBackend(newConditionalBucket())
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()

	buildTTL := 1 * time.Second
	cleanupTTL := 5 * time.Second
	store := NewBucketRemoteIndexStore(BucketRemoteIndexStoreConfig{
		Bucket:      bucket,
		LockBackend: backend,
		LockOwner:   "instance-1",
		BuildLock:   LockOptions{TTL: buildTTL, HeartbeatInterval: 200 * time.Millisecond},
		CleanupLock: LockOptions{TTL: cleanupTTL, HeartbeatInterval: 200 * time.Millisecond},
	})
	ns := newTestNsResource()

	buildLock, err := store.LockBuildIndex(ctx, ns, "11.5.0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = buildLock.Release() })

	info, err := backend.Read(ctx, buildIndexLockKey(ns, "11.5.0"))
	require.NoError(t, err)
	require.Equal(t, buildTTL, info.TTL)

	cleanupLock, err := store.LockNamespaceForCleanup(ctx, ns.Namespace)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cleanupLock.Release() })

	info, err = backend.Read(ctx, cleanupLockKey(ns.Namespace))
	require.NoError(t, err)
	require.Equal(t, cleanupTTL, info.TTL)
}

// hookableStore wraps a real BucketRemoteIndexStore (backed by an in-memory
// memblob bucket) and adds per-method error injection, call counters,
// mid-call callbacks, and controllable lock loss.
//
// Error injection and counters are at the interface-method level
// (WriteSnapshotFile, ReadSnapshotFile, ListIndexKeys, ...). Test setters
// like setUploadErr / setDownloadErr are spelled in terms of the
// higher-level intent ("fail the upload") but plumb into the underlying
// method-level field; this keeps test code readable without coupling it to
// the exact interface shape.
//
// Tests seed snapshots by writing directly to the bucket via seedSnapshot or
// seedDownloadableSnapshot, which lets them pin manifest fields independent
// of UploadIndexSnapshot's ULID-derived UploadTimestamp.
type hookableStore struct {
	inner  *BucketRemoteIndexStore
	bucket *blob.Bucket

	// Error injection. nil means pass through to the inner store.
	mu                   sync.Mutex
	lockBuildErr         error
	lockCleanupErr       error
	listKeysErr          error
	writeSnapshotFileErr error               // fires on any WriteSnapshotFile call
	readSnapshotFileErr  error               // fires on non-manifest ReadSnapshotFile (data-file phase of a download)
	readManifestErrs     map[ulid.ULID]error // fires on ReadSnapshotFile(manifest) for the keyed snapshot

	onUpload func() error

	// Counters.
	lockAcquireCalls  atomic.Int32
	lockReleaseCalls  atomic.Int32
	listKeyCalls      atomic.Int32 // ListIndexKeys
	readManifestCalls atomic.Int32 // ReadSnapshotFile(manifest)
	downloadCalls     atomic.Int32 // ReadSnapshotFile(non-manifest)
	uploadCalls       atomic.Int32 // WriteSnapshotFile(manifest) succeeded — upload complete

	// Last-upload captures. Reset when a write for a new indexKey arrives.
	lastUploadedMeta     IndexMeta
	lastUploadedFiles    []string
	lastUploadedKey      ulid.ULID
	lastLockBuildVersion string

	// Tracks the most recently acquired build lock so signalLockLost can
	// fire it.
	currentLock *hookableLock
}

// newHookableStore returns a fresh hookableStore wrapping a real
// BucketRemoteIndexStore over an in-memory memblob bucket.
func newHookableStore(t *testing.T) *hookableStore {
	t.Helper()
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })
	return &hookableStore{
		inner:  newTestRemoteIndexStore(t, bucket),
		bucket: bucket,
	}
}

func (s *hookableStore) LockBuildIndex(ctx context.Context, ns resource.NamespacedResource, buildVersion string) (IndexStoreLock, error) {
	s.lockAcquireCalls.Add(1)
	s.mu.Lock()
	s.lastLockBuildVersion = buildVersion
	injected := s.lockBuildErr
	s.mu.Unlock()
	if injected != nil {
		return nil, injected
	}
	innerLock, err := s.inner.LockBuildIndex(ctx, ns, buildVersion)
	if err != nil {
		return nil, err
	}
	lock := newHookableLock(innerLock, s)
	s.mu.Lock()
	s.currentLock = lock
	s.mu.Unlock()
	return lock, nil
}

func (s *hookableStore) LockNamespaceForCleanup(ctx context.Context, namespace string) (IndexStoreLock, error) {
	s.mu.Lock()
	injected := s.lockCleanupErr
	s.mu.Unlock()
	if injected != nil {
		return nil, injected
	}
	return s.inner.LockNamespaceForCleanup(ctx, namespace)
}

func (s *hookableStore) WriteSnapshotFile(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, in io.Reader) error {
	isManifest := relPath == snapshotManifestFile

	s.mu.Lock()
	// Reset per-upload captures when we see a write for a new key.
	if s.lastUploadedKey != indexKey {
		s.lastUploadedKey = indexKey
		s.lastUploadedFiles = nil
		s.lastUploadedMeta = IndexMeta{}
	}
	onUpload := s.onUpload
	injected := s.writeSnapshotFileErr
	s.mu.Unlock()

	if isManifest {
		// Capture the manifest by reading in into a buffer; re-supply via a
		// fresh Reader so the inner store sees the original bytes.
		data, err := io.ReadAll(in)
		if err != nil {
			return err
		}
		var meta IndexMeta
		_ = json.Unmarshal(data, &meta) // best-effort; tests inspect what they wrote
		s.mu.Lock()
		s.lastUploadedMeta = meta
		s.mu.Unlock()
		in = bytes.NewReader(data)

		// onUpload fires between the data-file writes and the manifest
		// write — a deterministic point where the upload is on the verge of
		// being marked complete.
		if onUpload != nil {
			if err := onUpload(); err != nil {
				return err
			}
		}
	} else {
		s.mu.Lock()
		s.lastUploadedFiles = append(s.lastUploadedFiles, relPath)
		s.mu.Unlock()
	}

	if injected != nil {
		return injected
	}
	if err := s.inner.WriteSnapshotFile(ctx, ns, indexKey, relPath, in); err != nil {
		return err
	}
	if isManifest {
		s.uploadCalls.Add(1)
	}
	return nil
}

func (s *hookableStore) ReadSnapshotFile(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, out io.Writer) error {
	isManifest := relPath == snapshotManifestFile

	s.mu.Lock()
	var injected error
	if isManifest {
		injected = s.readManifestErrs[indexKey]
	} else {
		injected = s.readSnapshotFileErr
	}
	s.mu.Unlock()

	if isManifest {
		s.readManifestCalls.Add(1)
	} else {
		s.downloadCalls.Add(1)
	}

	if injected != nil {
		return injected
	}
	return s.inner.ReadSnapshotFile(ctx, ns, indexKey, relPath, out)
}

func (s *hookableStore) ListNamespaces(ctx context.Context) ([]string, error) {
	return s.inner.ListNamespaces(ctx)
}

func (s *hookableStore) ListNamespaceResources(ctx context.Context, namespace string) ([]resource.NamespacedResource, error) {
	return s.inner.ListNamespaceResources(ctx, namespace)
}

func (s *hookableStore) ListIndexKeys(ctx context.Context, ns resource.NamespacedResource) ([]ulid.ULID, error) {
	s.listKeyCalls.Add(1)
	s.mu.Lock()
	injected := s.listKeysErr
	s.mu.Unlock()
	if injected != nil {
		return nil, injected
	}
	return s.inner.ListIndexKeys(ctx, ns)
}

func (s *hookableStore) DeleteIndex(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID) error {
	return s.inner.DeleteIndex(ctx, ns, indexKey)
}

// setLockBuildErr installs an error for the next LockBuildIndex calls. Use
// errLockHeld to simulate "another instance is the leader", or any other
// error to simulate a lock-backend failure. Pass nil to clear.
func (s *hookableStore) setLockBuildErr(err error) {
	s.mu.Lock()
	s.lockBuildErr = err
	s.mu.Unlock()
}

func (s *hookableStore) setListKeysErr(err error) {
	s.mu.Lock()
	s.listKeysErr = err
	s.mu.Unlock()
}

// setUploadErr makes the next WriteSnapshotFile call (data file or
// manifest) return err. Used to simulate "the upload fails partway".
func (s *hookableStore) setUploadErr(err error) {
	s.mu.Lock()
	s.writeSnapshotFileErr = err
	s.mu.Unlock()
}

// setDownloadErr makes data-file ReadSnapshotFile calls return err.
// Manifest reads are not affected, so probes / ReadIndexSnapshotManifest still succeed;
// only the actual file-streaming phase of DownloadIndexSnapshot fails.
func (s *hookableStore) setDownloadErr(err error) {
	s.mu.Lock()
	s.readSnapshotFileErr = err
	s.mu.Unlock()
}

// getLastUploadedMeta returns the IndexMeta most recently written to the
// manifest via WriteSnapshotFile. The captured meta reflects what the
// production code uploaded, which makes assertions about manifest fields
// (BuildVersion, LatestResourceVersion, BuildTime, ...) straightforward.
func (s *hookableStore) getLastUploadedMeta() IndexMeta {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastUploadedMeta
}

// getLastUploadedFiles returns the slash-separated relative paths captured
// from non-manifest WriteSnapshotFile calls for the most recently uploaded
// snapshot. Reset implicitly when a write for a new indexKey arrives.
func (s *hookableStore) getLastUploadedFiles() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.lastUploadedFiles...)
}

func (s *hookableStore) getLastLockBuildVersion() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastLockBuildVersion
}

// setReadManifestErr installs an error to return on the next manifest read for
// indexKey — i.e. ReadSnapshotFile(ns, indexKey, snapshotManifestFile, w).
// Existing snapshot data in the bucket is left in place; only the manifest
// read for this key fails. Used to simulate ErrSnapshotNotFound /
// ErrInvalidManifest at a specific key without disturbing the bucket.
func (s *hookableStore) setReadManifestErr(indexKey ulid.ULID, err error) {
	s.mu.Lock()
	if s.readManifestErrs == nil {
		s.readManifestErrs = map[ulid.ULID]error{}
	}
	s.readManifestErrs[indexKey] = err
	s.mu.Unlock()
}

// setOnUpload installs a callback fired inside WriteSnapshotFile just
// before the manifest write — i.e. after all data files have been
// uploaded, but before the upload is marked complete. The callback's
// returned error short-circuits the upload. Used to trigger races (e.g.
// concurrent mutations during upload) at a deterministic point.
func (s *hookableStore) setOnUpload(fn func() error) {
	s.mu.Lock()
	s.onUpload = fn
	s.mu.Unlock()
}

// signalLockLost closes the Lost() channel on the most recently acquired
// build lock, simulating a heartbeat-detected lease loss without depending
// on real heartbeat timing.
func (s *hookableStore) signalLockLost() {
	s.mu.Lock()
	lock := s.currentLock
	s.mu.Unlock()
	if lock != nil {
		lock.markLost()
	}
}

// hookableLock wraps a real IndexStoreLock so tests can drive lock loss via
// signalLockLost without depending on real heartbeat timing. The exposed
// Lost() channel only closes when markLost is called; inner-lock loss is
// not forwarded, because no test triggers it (real heartbeat loss requires
// disturbing the bucket entry, which no test does).
type hookableLock struct {
	inner       IndexStoreLock
	lost        chan struct{}
	lostOnce    sync.Once
	releaseOnce sync.Once
	store       *hookableStore
}

func newHookableLock(inner IndexStoreLock, store *hookableStore) *hookableLock {
	return &hookableLock{inner: inner, lost: make(chan struct{}), store: store}
}

func (l *hookableLock) Release() error {
	var err error
	l.releaseOnce.Do(func() {
		l.store.lockReleaseCalls.Add(1)
		err = l.inner.Release()
	})
	return err
}

func (l *hookableLock) Lost() <-chan struct{} { return l.lost }

func (l *hookableLock) markLost() {
	l.lostOnce.Do(func() { close(l.lost) })
}

// seedSnapshot writes a snapshot at indexKey under ns directly to bucket,
// bypassing store.UploadIndexSnapshot. The snapshot has a single placeholder file
// plus a manifest with the caller-provided meta. Use this when a test only
// needs the snapshot to be visible to ListIndexSnapshots / ReadIndexSnapshotManifest — the
// snapshot is not downloadable as a real bleve index.
//
// Manifest fields (UploadTimestamp, BuildTime, etc.) are written as-is, so
// callers can pin arbitrary values independent of indexKey's ULID time.
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

// downloadableSnapshot is a snapshot prepared in memory and ready to be
// written to a bucket. Building uses testing.T (require.*); publishing
// returns errors, so the publish step can run on a helper goroutine
// without violating the testing.TB rule that FailNow must run on the test
// goroutine.
type downloadableSnapshot struct {
	prefix   string
	files    map[string][]byte
	manifest []byte
}

// buildDownloadableSnapshot creates a real (minimal) bleve index for
// indexKey under ns, walks it into memory, and marshals a manifest. The
// returned snapshot can be published to any bucket via publish.
//
// The internal buildInfo.BuildTime is taken from meta.BuildTime when
// non-zero, falling back to meta.UploadTimestamp. This mirrors production:
// real snapshots derive manifest BuildTime from the index's internal
// buildInfo (see bleve_snapshot_upload.go), so the two stay consistent
// when readers (local reuse vs fresh-remote selection) compare them.
func buildDownloadableSnapshot(t *testing.T, ns resource.NamespacedResource, indexKey ulid.ULID, meta *IndexMeta) *downloadableSnapshot {
	t.Helper()
	srcDir := filepath.Join(t.TempDir(), "idx")
	idx, err := bleve.New(srcDir, bleve.NewIndexMapping())
	require.NoError(t, err)
	require.NoError(t, setRV(idx, meta.LatestResourceVersion))

	buildTime := meta.BuildTime
	if buildTime.IsZero() {
		buildTime = meta.UploadTimestamp
	}
	bi, err := json.Marshal(buildInfo{
		BuildTime:    buildTime.Unix(),
		BuildVersion: meta.BuildVersion,
	})
	require.NoError(t, err)
	require.NoError(t, idx.SetInternal([]byte(internalBuildInfoKey), bi))
	require.NoError(t, idx.Close())

	files := map[string][]byte{}
	require.NoError(t, filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path) //nolint:gosec // path is under a test-controlled temp dir
		if err != nil {
			return err
		}
		files[filepath.ToSlash(rel)] = data
		return nil
	}))

	if meta.Files == nil {
		meta.Files = make(map[string]int64, len(files))
		for rel, data := range files {
			meta.Files[rel] = int64(len(data))
		}
	}
	manifest, err := json.Marshal(meta)
	require.NoError(t, err)

	return &downloadableSnapshot{
		prefix:   indexPrefix(ns, indexKey.String()),
		files:    files,
		manifest: manifest,
	}
}

// publish writes the snapshot's data files first, then the manifest (which
// is the completion signal). Uses no testing.T, so it is safe to call from
// a helper goroutine.
func (s *downloadableSnapshot) publish(ctx context.Context, bucket *blob.Bucket) error {
	for rel, data := range s.files {
		if err := bucket.WriteAll(ctx, s.prefix+rel, data, nil); err != nil {
			return fmt.Errorf("writing %s: %w", rel, err)
		}
	}
	return bucket.WriteAll(ctx, s.prefix+snapshotManifestFile, s.manifest, nil)
}

// seedDownloadableSnapshot is buildDownloadableSnapshot + publish, for the
// common case of seeding before the system under test runs. For tests that
// need to publish from a helper goroutine, call buildDownloadableSnapshot
// on the test goroutine and publish from the goroutine via the returned
// snapshot.
func seedDownloadableSnapshot(t *testing.T, ctx context.Context, bucket *blob.Bucket, ns resource.NamespacedResource, indexKey ulid.ULID, meta *IndexMeta) {
	t.Helper()
	require.NoError(t, buildDownloadableSnapshot(t, ns, indexKey, meta).publish(ctx, bucket))
}

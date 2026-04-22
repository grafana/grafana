package search

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
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

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

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
	store := NewBucketRemoteIndexStore(testBucket(t))
	ctx := context.Background()
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		LatestResourceVersion: 99,
	}

	indexKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)
	t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

	destDir := filepath.Join(t.TempDir(), "downloaded")
	gotMeta, err := store.DownloadIndex(ctx, ns, indexKey, destDir)
	require.NoError(t, err)
	assert.Equal(t, meta.GrafanaBuildVersion, gotMeta.GrafanaBuildVersion)
	assert.Equal(t, meta.LatestResourceVersion, gotMeta.LatestResourceVersion)

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

func TestRemoteIndexStore_ListAndDeleteIndexes(t *testing.T) {
	store := NewBucketRemoteIndexStore(testBucket(t))
	ctx := context.Background()
	ns := newTestNsResource()

	keys := make([]ulid.ULID, 0, 3)
	for range 3 {
		srcDir := createTestBleveIndex(t)
		meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
		key, err := store.UploadIndex(ctx, ns, srcDir, meta)
		require.NoError(t, err)
		keys = append(keys, key)
		t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, key) })
	}

	indexes, err := store.ListIndexes(ctx, ns)
	require.NoError(t, err)
	assert.Len(t, indexes, 3)
	for _, key := range keys {
		assert.Contains(t, indexes, key)
	}

	for _, key := range keys {
		require.NoError(t, store.DeleteIndex(ctx, ns, key))
	}
	indexes, err = store.ListIndexes(ctx, ns)
	require.NoError(t, err)
	assert.Empty(t, indexes)

	// Download of a deleted index should fail
	_, err = store.DownloadIndex(ctx, ns, keys[0], filepath.Join(t.TempDir(), "dl"))
	require.Error(t, err)
}

func TestValidateManifestPaths(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]int64
		wantErr string
	}{
		{name: "valid paths", files: map[string]int64{"store/root.bolt": 100, "store/00001.zap": 200}},
		{name: "path traversal", files: map[string]int64{"../../../tmp/escape": 100}, wantErr: "invalid path"},
		{name: "absolute path", files: map[string]int64{"/tmp/escape": 100}, wantErr: "invalid path"},
		{name: "non-canonical dotslash", files: map[string]int64{"./store/root.bolt": 100}, wantErr: "non-canonical"},
		{name: "non-canonical double dot", files: map[string]int64{"store/../store/root.bolt": 100}, wantErr: "non-canonical"},
		{name: "dot entry", files: map[string]int64{".": 100}, wantErr: "invalid path"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateManifestPaths(tt.files)
			if tt.wantErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
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
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)

	// Add a symlink into the bleve index directory
	externalFile := filepath.Join(t.TempDir(), "secret.txt")
	require.NoError(t, os.WriteFile(externalFile, []byte("secret"), 0600))
	require.NoError(t, os.Symlink(externalFile, filepath.Join(srcDir, "sneaky.zap")))

	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrNonRegularFile)
}

func TestRemoteIndexStore_DownloadRejectsCorruptMetaJSON(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()
	key := ulid.Make()
	pfx := indexPrefix(ns, key.String())

	t.Run("missing meta.json", func(t *testing.T) {
		_, err := store.DownloadIndex(ctx, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "reading meta.json")
	})

	t.Run("invalid JSON", func(t *testing.T) {
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", []byte("{not json"), nil))
		_, err := store.DownloadIndex(ctx, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "parsing meta.json")
	})

	t.Run("empty file manifest", func(t *testing.T) {
		meta := IndexMeta{GrafanaBuildVersion: "11.0.0", Files: map[string]int64{}}
		metaBytes, err := json.Marshal(meta)
		require.NoError(t, err)
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", metaBytes, nil))
		_, err = store.DownloadIndex(ctx, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "empty file manifest")
	})

	t.Run("non-canonical path", func(t *testing.T) {
		meta := IndexMeta{GrafanaBuildVersion: "11.0.0", Files: map[string]int64{"store/../store/root.bolt": 100}}
		metaBytes, err := json.Marshal(meta)
		require.NoError(t, err)
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", metaBytes, nil))
		_, err = store.DownloadIndex(ctx, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "non-canonical")
	})

	t.Run("absolute path", func(t *testing.T) {
		meta := IndexMeta{GrafanaBuildVersion: "11.0.0", Files: map[string]int64{"/etc/passwd": 100}}
		metaBytes, err := json.Marshal(meta)
		require.NoError(t, err)
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", metaBytes, nil))
		_, err = store.DownloadIndex(ctx, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid")
	})

	t.Run("oversized meta.json", func(t *testing.T) {
		// Write a meta.json that exceeds the 1 MiB limit
		oversized := make([]byte, maxMetaJSONSize+1)
		for i := range oversized {
			oversized[i] = 'x'
		}
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", oversized, nil))
		_, err := store.DownloadIndex(ctx, ns, key, filepath.Join(t.TempDir(), "dl"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "write limit exceeded")
	})
}

func TestRemoteIndexStore_DownloadValidatesCompleteness(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
	indexKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	// Delete one file from the bucket to simulate partial upload
	pfx := indexPrefix(ns, indexKey.String())
	metaRaw, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(metaRaw, &meta))
	for relPath := range meta.Files {
		require.NoError(t, bucket.Delete(ctx, pfx+relPath))
		break
	}

	_, err = store.DownloadIndex(ctx, ns, indexKey, filepath.Join(t.TempDir(), "dl"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "not found")
}

func TestRemoteIndexStore_UploadRejectsEmptyDirectory(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()

	emptyDir := t.TempDir()
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := store.UploadIndex(ctx, ns, emptyDir, meta)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no files to upload")
}

func TestRemoteIndexStore_UploadExcludesMetaJSON(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	// Plant a stale meta.json in the source directory
	require.NoError(t, os.WriteFile(filepath.Join(srcDir, "meta.json"), []byte(`{"stale":"data"}`), 0600))

	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
	indexKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	pfx := indexPrefix(ns, indexKey.String())
	metaBytes, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	var uploaded IndexMeta
	require.NoError(t, json.Unmarshal(metaBytes, &uploaded))
	require.NotContains(t, uploaded.Files, "meta.json")
}

// --- Error injection tests (memblob + errorBucket) ---

type errorBucket struct {
	resource.CDKBucket
	uploadErr   error
	downloadErr error
	downloadFn  func(key string) error // if set, called instead of downloadErr
	writeAllErr error
	readAllErr  error
	deleteErr   error
}

func (e *errorBucket) Upload(ctx context.Context, key string, r io.Reader, opts *blob.WriterOptions) error {
	if e.uploadErr != nil {
		return e.uploadErr
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

func (e *errorBucket) WriteAll(ctx context.Context, key string, p []byte, opts *blob.WriterOptions) error {
	if e.writeAllErr != nil {
		return e.writeAllErr
	}
	return e.CDKBucket.WriteAll(ctx, key, p, opts)
}

func (e *errorBucket) ReadAll(ctx context.Context, key string) ([]byte, error) {
	if e.readAllErr != nil {
		return nil, e.readAllErr
	}
	return e.CDKBucket.ReadAll(ctx, key)
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
		store := NewBucketRemoteIndexStore(bucket)
		srcDir := createTestBleveIndex(t)
		meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
		key, err := store.UploadIndex(ctx, ns, srcDir, meta)
		require.NoError(t, err)
		return key
	}

	t.Run("upload file error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewBucketRemoteIndexStore(&errorBucket{CDKBucket: real, uploadErr: fmt.Errorf("upload network timeout")})

		_, err := store.UploadIndex(ctx, ns, createTestBleveIndex(t),
			IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10})
		require.Error(t, err)
		require.Contains(t, err.Error(), "upload network timeout")
	})

	t.Run("meta.json write error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewBucketRemoteIndexStore(&errorBucket{CDKBucket: real, writeAllErr: fmt.Errorf("write quota exceeded")})

		_, err := store.UploadIndex(ctx, ns, createTestBleveIndex(t),
			IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10})
		require.Error(t, err)
		require.Contains(t, err.Error(), "write quota exceeded")
	})

	t.Run("meta.json download error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewBucketRemoteIndexStore(&errorBucket{
			CDKBucket: real,
			downloadFn: func(key string) error {
				if strings.HasSuffix(key, "/meta.json") {
					return fmt.Errorf("access denied")
				}
				return nil
			},
		})

		_, err := store.DownloadIndex(ctx, ns, ulid.Make(), filepath.Join(t.TempDir(), "dl"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "access denied")
	})

	t.Run("file download error cleans up staging dir", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		key := uploadSnapshot(t, real)
		store := NewBucketRemoteIndexStore(&errorBucket{CDKBucket: real, downloadErr: fmt.Errorf("connection reset")})

		parentDir := t.TempDir()
		destDir := filepath.Join(parentDir, "downloaded")
		_, err := store.DownloadIndex(ctx, ns, key, destDir)
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
		store := NewBucketRemoteIndexStore(real)

		destDir := t.TempDir() // already exists
		_, err := store.DownloadIndex(ctx, ns, key, destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "destination already exists")
	})

	t.Run("delete error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		key := uploadSnapshot(t, real)
		store := NewBucketRemoteIndexStore(&errorBucket{CDKBucket: real, deleteErr: fmt.Errorf("permission denied")})

		err := store.DeleteIndex(ctx, ns, key)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})
}

func TestRemoteIndexStore_CleanupIncompleteUploads(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Upload a complete index (has meta.json)
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
	completeKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	// Simulate an incomplete upload: write objects under a ULID prefix without meta.json
	incompleteKey := ulid.Make()
	incompletePfx := indexPrefix(ns, incompleteKey.String())
	require.NoError(t, bucket.WriteAll(ctx, incompletePfx+"store/root.bolt", []byte("orphaned"), nil))
	require.NoError(t, bucket.WriteAll(ctx, incompletePfx+"store/00000001.zap", []byte("orphaned"), nil))

	// Cleanup should remove only the incomplete prefix
	cleaned, err := store.CleanupIncompleteUploads(ctx, ns, 0)
	require.NoError(t, err)
	assert.Equal(t, 1, cleaned)

	// Complete index should still be intact
	indexes, err := store.ListIndexes(ctx, ns)
	require.NoError(t, err)
	assert.Contains(t, indexes, completeKey)

	// Incomplete prefix should be gone
	iter := bucket.List(&blob.ListOptions{Prefix: incompletePfx})
	obj, err := iter.Next(ctx)
	assert.Nil(t, obj)
	assert.ErrorIs(t, err, io.EOF)
}

func TestRemoteIndexStore_CleanupIncompleteUploads_NoneFound(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Upload a complete index
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	// Nothing to clean
	cleaned, err := store.CleanupIncompleteUploads(ctx, ns, 0)
	require.NoError(t, err)
	assert.Equal(t, 0, cleaned)
}

func TestRemoteIndexStore_CleanupIncompleteUploads_CorruptManifest(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Upload a valid complete index
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", LatestResourceVersion: 10}
	completeKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	t.Run("invalid JSON manifest", func(t *testing.T) {
		key := ulid.Make()
		pfx := indexPrefix(ns, key.String())
		require.NoError(t, bucket.WriteAll(ctx, pfx+"store/root.bolt", []byte("data"), nil))
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", []byte("{corrupt"), nil))

		cleaned, err := store.CleanupIncompleteUploads(ctx, ns, 0)
		require.NoError(t, err)
		assert.Equal(t, 1, cleaned)
	})

	t.Run("empty files manifest", func(t *testing.T) {
		key := ulid.Make()
		pfx := indexPrefix(ns, key.String())
		require.NoError(t, bucket.WriteAll(ctx, pfx+"store/root.bolt", []byte("data"), nil))
		emptyMeta, _ := json.Marshal(IndexMeta{GrafanaBuildVersion: "11.0.0", Files: map[string]int64{}})
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", emptyMeta, nil))

		cleaned, err := store.CleanupIncompleteUploads(ctx, ns, 0)
		require.NoError(t, err)
		assert.Equal(t, 1, cleaned)
	})

	// Complete index should still be intact after all cleanups
	indexes, err := store.ListIndexes(ctx, ns)
	require.NoError(t, err)
	assert.Contains(t, indexes, completeKey)
}

func TestRemoteIndexStore_CleanupIncompleteUploads_MinAge(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewBucketRemoteIndexStore(bucket)
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

	// Cleanup with minAge=1h should only delete the old prefix.
	cleaned, err := store.CleanupIncompleteUploads(ctx, ns, 1*time.Hour)
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

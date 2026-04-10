package search

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
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

// testBucketSetup holds a named bucket configuration for multi-backend tests.
//
// fileblob always runs. Set CDK_TEST_BUCKET_URL to also run against a real provider:
//
//	CDK_TEST_BUCKET_URL=gs://my-test-bucket go test ./pkg/storage/unified/search/... -v
type testBucketSetup struct {
	name    string
	bucket  *blob.Bucket
	cleanup func()
}

func testBucketSetups(t *testing.T) []testBucketSetup {
	t.Helper()
	var setups []testBucketSetup

	dir := t.TempDir()
	fb, err := fileblob.OpenBucket(dir, nil)
	require.NoError(t, err)
	setups = append(setups, testBucketSetup{
		name:    "fileblob",
		bucket:  fb,
		cleanup: func() { _ = fb.Close() },
	})

	if bucketURL := os.Getenv("CDK_TEST_BUCKET_URL"); bucketURL != "" {
		ctx := context.Background()
		rb, err := blob.OpenBucket(ctx, bucketURL)
		require.NoError(t, err)
		setups = append(setups, testBucketSetup{
			name:    "remote:" + bucketURL,
			bucket:  rb,
			cleanup: func() { _ = rb.Close() },
		})
	}

	return setups
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

// setupTestFiles creates files in dir from a map of relative paths to content.
func setupTestFiles(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for rel, content := range files {
		path := filepath.Join(dir, filepath.FromSlash(rel))
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0750))
		require.NoError(t, os.WriteFile(path, []byte(content), 0600))
	}
}

// --- Multi-backend tests (fileblob + optional remote) ---

func TestRemoteIndexStore_UploadDownloadBleveIndex(t *testing.T) {
	for _, setup := range testBucketSetups(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newTestNsResource()

			srcDir := createTestBleveIndex(t)
			meta := IndexMeta{
				GrafanaBuildVersion:   "11.0.0",
				UploadTimestamp:       time.Now().Truncate(time.Second),
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
			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))
		})
	}
}

func TestRemoteIndexStore_ListIndexes(t *testing.T) {
	for _, setup := range testBucketSetups(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newTestNsResource()

			keys := make([]ulid.ULID, 0, 3)
			for range 3 {
				srcDir := createTestBleveIndex(t)
				meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
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
		})
	}
}

func TestRemoteIndexStore_DeleteIndex(t *testing.T) {
	for _, setup := range testBucketSetups(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newTestNsResource()

			srcDir := createTestBleveIndex(t)
			meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
			indexKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
			require.NoError(t, err)
			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))

			indexes, err := store.ListIndexes(ctx, ns)
			require.NoError(t, err)
			assert.NotContains(t, indexes, indexKey)

			_, err = store.DownloadIndex(ctx, ns, indexKey, t.TempDir())
			require.Error(t, err)
		})
	}
}

// --- memblob-only tests (require direct bucket manipulation) ---

func TestRemoteIndexStore_DownloadRejectsPathTraversal(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
	indexKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	// Tamper with meta.json to include a path traversal entry
	pfx := indexPrefix(ns, indexKey.String())
	metaRaw, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(metaRaw, &meta))
	meta.Files["../../../etc/another-file"] = 100
	metaBytes, err := json.Marshal(meta)
	require.NoError(t, err)
	require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", metaBytes, nil))

	_, err = store.DownloadIndex(ctx, ns, indexKey, t.TempDir())
	require.Error(t, err)
	require.Contains(t, err.Error(), "path traversal")
}

func TestRemoteIndexStore_UploadRejectsPathTraversal(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)

	// Add a symlink pointing outside the source directory
	externalFile := filepath.Join(t.TempDir(), "another.txt")
	require.NoError(t, os.WriteFile(externalFile, []byte("another"), 0600))
	require.NoError(t, os.Symlink(externalFile, filepath.Join(srcDir, "sneaky.zap")))

	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
	_, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrNonRegularFile)
}

func TestRemoteIndexStore_UploadRejectsNonRegularFiles(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)

	// Add a symlink into the bleve index directory
	externalFile := filepath.Join(t.TempDir(), "secret.txt")
	require.NoError(t, os.WriteFile(externalFile, []byte("secret"), 0600))
	require.NoError(t, os.Symlink(externalFile, filepath.Join(srcDir, "sneaky.zap")))

	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
	_, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrNonRegularFile)
}

func TestRemoteIndexStore_DownloadRejectsSymlinkedSubdir(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Upload a snapshot with a nested file
	srcDir := t.TempDir()
	setupTestFiles(t, srcDir, map[string]string{
		"store/root.bolt": "bolt-data",
	})
	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 10,
	}
	indexKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	// Prepare a dest dir where "store" is a symlink pointing outside
	destDir := t.TempDir()
	outsideDir := t.TempDir()
	require.NoError(t, os.Symlink(outsideDir, filepath.Join(destDir, "store")))

	_, err = store.DownloadIndex(ctx, ns, indexKey, destDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), "symlink")

	// Verify the file was NOT written to the outside directory
	_, statErr := os.Stat(filepath.Join(outsideDir, "root.bolt"))
	require.True(t, os.IsNotExist(statErr))
}

func TestRemoteIndexStore_DownloadRejectsSymlinkedFile(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Upload a snapshot with a single file
	srcDir := t.TempDir()
	setupTestFiles(t, srcDir, map[string]string{
		"00000001.zap": "segment-data",
	})
	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 10,
	}
	indexKey, err := store.UploadIndex(ctx, ns, srcDir, meta)
	require.NoError(t, err)

	// Prepare a dest dir where the leaf file is a symlink pointing outside
	destDir := t.TempDir()
	outsideFile := filepath.Join(t.TempDir(), "victim.txt")
	require.NoError(t, os.WriteFile(outsideFile, []byte("original"), 0600))
	require.NoError(t, os.Symlink(outsideFile, filepath.Join(destDir, "00000001.zap")))

	_, err = store.DownloadIndex(ctx, ns, indexKey, destDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), "symlink")

	// Verify the outside file was NOT overwritten
	content, readErr := os.ReadFile(outsideFile) //nolint:gosec // test code with controlled paths
	require.NoError(t, readErr)
	require.Equal(t, "original", string(content))
}

func TestRemoteIndexStore_DownloadRejectsCorruptMetaJSON(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
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
}

func TestRemoteIndexStore_DownloadValidatesCompleteness(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
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

	_, err = store.DownloadIndex(ctx, ns, indexKey, t.TempDir())
	require.Error(t, err)
	require.Contains(t, err.Error(), "downloading")
}

func TestRemoteIndexStore_UploadRejectsEmptyDirectory(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	emptyDir := t.TempDir()
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
	_, err := store.UploadIndex(ctx, ns, emptyDir, meta)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no files to upload")
}

func TestRemoteIndexStore_UploadExcludesMetaJSON(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	// Plant a stale meta.json in the source directory
	require.NoError(t, os.WriteFile(filepath.Join(srcDir, "meta.json"), []byte(`{"stale":"data"}`), 0600))

	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
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
	if e.downloadErr != nil {
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
		store := NewRemoteIndexStore(bucket)
		srcDir := createTestBleveIndex(t)
		meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
		key, err := store.UploadIndex(ctx, ns, srcDir, meta)
		require.NoError(t, err)
		return key
	}

	t.Run("upload file error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, uploadErr: fmt.Errorf("upload network timeout")})

		_, err := store.UploadIndex(ctx, ns, createTestBleveIndex(t),
			IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10})
		require.Error(t, err)
		require.Contains(t, err.Error(), "upload network timeout")
	})

	t.Run("meta.json write error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, writeAllErr: fmt.Errorf("write quota exceeded")})

		_, err := store.UploadIndex(ctx, ns, createTestBleveIndex(t),
			IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10})
		require.Error(t, err)
		require.Contains(t, err.Error(), "write quota exceeded")
	})

	t.Run("meta.json read error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, readAllErr: fmt.Errorf("access denied")})

		_, err := store.DownloadIndex(ctx, ns, ulid.Make(), t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "access denied")
	})

	t.Run("file download error cleans up partial files", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		key := uploadSnapshot(t, real)
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, downloadErr: fmt.Errorf("connection reset")})

		destDir := t.TempDir()
		_, err := store.DownloadIndex(ctx, ns, key, destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "connection reset")

		entries, _ := os.ReadDir(destDir)
		for _, e := range entries {
			require.True(t, e.IsDir(), "no partial files should remain: %s", e.Name())
		}
	})

	t.Run("delete error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		key := uploadSnapshot(t, real)
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, deleteErr: fmt.Errorf("permission denied")})

		err := store.DeleteIndex(ctx, ns, key)
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})
}

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

// --- Multi-backend tests (fileblob + optional remote) ---

func TestRemoteIndexStore_UploadDownloadBleveIndex(t *testing.T) {
	for _, setup := range testBucketSetups(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newTestNsResource()
			indexKey := "roundtrip"

			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			srcDir := createTestBleveIndex(t)
			meta := IndexMeta{
				GrafanaBuildVersion:   "11.0.0",
				UploadTimestamp:       time.Now().Truncate(time.Second),
				LatestResourceVersion: 99,
			}

			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir, meta))

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

			keys := []string{"list-001", "list-002", "list-003"}
			for _, key := range keys {
				key := key
				t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, key) })
			}

			for _, key := range keys {
				srcDir := createTestBleveIndex(t)
				meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
				require.NoError(t, store.UploadIndex(ctx, ns, key, srcDir, meta))
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
			indexKey := "delete-test"

			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			srcDir := createTestBleveIndex(t)
			meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir, meta))

			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))

			indexes, err := store.ListIndexes(ctx, ns)
			require.NoError(t, err)
			assert.NotContains(t, indexes, indexKey)

			_, err = store.DownloadIndex(ctx, ns, indexKey, t.TempDir())
			require.Error(t, err)
		})
	}
}

func TestRemoteIndexStore_RejectsOverwrite(t *testing.T) {
	for _, setup := range testBucketSetups(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newTestNsResource()
			indexKey := "immutable-test"

			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			srcDir := createTestBleveIndex(t)
			meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 100}
			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir, meta))

			// Second upload to the same key must fail
			srcDir2 := createTestBleveIndex(t)
			meta2 := IndexMeta{GrafanaBuildVersion: "12.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 200}
			err := store.UploadIndex(ctx, ns, indexKey, srcDir2, meta2)
			require.Error(t, err)
			require.Contains(t, err.Error(), "already exists")

			// Original index is still intact
			destDir := filepath.Join(t.TempDir(), "downloaded")
			gotMeta, err := store.DownloadIndex(ctx, ns, indexKey, destDir)
			require.NoError(t, err)
			assert.Equal(t, int64(100), gotMeta.LatestResourceVersion)

			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))
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
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	// Tamper with meta.json to include a path traversal entry
	pfx := indexPrefix(ns, "snap-001")
	metaRaw, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(metaRaw, &meta))
	meta.Files["../../../etc/another-file"] = 100
	metaBytes, err := json.Marshal(meta)
	require.NoError(t, err)
	require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", metaBytes, nil))

	_, err = store.DownloadIndex(ctx, ns, "snap-001", t.TempDir())
	require.Error(t, err)
	require.Contains(t, err.Error(), "path traversal")
}

func TestRemoteIndexStore_RejectsInvalidIndexKey(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now(), LatestResourceVersion: 1}

	for _, badKey := range []string{"", "../escape", "a/b", ".", ".."} {
		require.Error(t, store.UploadIndex(ctx, ns, badKey, srcDir, meta), "key=%q", badKey)
		_, err := store.DownloadIndex(ctx, ns, badKey, srcDir)
		require.Error(t, err, "key=%q", badKey)
		require.Error(t, store.DeleteIndex(ctx, ns, badKey), "key=%q", badKey)
	}
}

func TestRemoteIndexStore_UploadSkipsSymlinks(t *testing.T) {
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
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	pfx := indexPrefix(ns, "snap-001")
	metaBytes, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	var uploaded IndexMeta
	require.NoError(t, json.Unmarshal(metaBytes, &uploaded))
	require.NotContains(t, uploaded.Files, "sneaky.zap")
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
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	// Prepare a dest dir where "store" is a symlink pointing outside
	destDir := t.TempDir()
	outsideDir := t.TempDir()
	require.NoError(t, os.Symlink(outsideDir, filepath.Join(destDir, "store")))

	_, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
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
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	// Prepare a dest dir where the leaf file is a symlink pointing outside
	destDir := t.TempDir()
	outsideFile := filepath.Join(t.TempDir(), "victim.txt")
	require.NoError(t, os.WriteFile(outsideFile, []byte("original"), 0600))
	require.NoError(t, os.Symlink(outsideFile, filepath.Join(destDir, "00000001.zap")))

	_, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
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
	pfx := indexPrefix(ns, "snap-001")

	t.Run("missing meta.json", func(t *testing.T) {
		_, err := store.DownloadIndex(ctx, ns, "snap-001", t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "reading meta.json")
	})

	t.Run("invalid JSON", func(t *testing.T) {
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", []byte("{not json"), nil))
		_, err := store.DownloadIndex(ctx, ns, "snap-001", t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "parsing meta.json")
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
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	// Delete one file from the bucket to simulate partial upload
	pfx := indexPrefix(ns, "snap-001")
	metaRaw, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(metaRaw, &meta))
	for relPath := range meta.Files {
		require.NoError(t, bucket.Delete(ctx, pfx+relPath))
		break
	}

	_, err = store.DownloadIndex(ctx, ns, "snap-001", t.TempDir())
	require.Error(t, err)
	require.Contains(t, err.Error(), "downloading")
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
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	pfx := indexPrefix(ns, "snap-001")
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

	uploadSnapshot := func(t *testing.T, bucket *blob.Bucket) {
		t.Helper()
		store := NewRemoteIndexStore(bucket)
		srcDir := createTestBleveIndex(t)
		meta := IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10}
		require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))
	}

	t.Run("upload file error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, uploadErr: fmt.Errorf("upload network timeout")})

		err := store.UploadIndex(ctx, ns, "snap-001", createTestBleveIndex(t),
			IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10})
		require.Error(t, err)
		require.Contains(t, err.Error(), "upload network timeout")
	})

	t.Run("meta.json write error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, writeAllErr: fmt.Errorf("write quota exceeded")})

		err := store.UploadIndex(ctx, ns, "snap-001", createTestBleveIndex(t),
			IndexMeta{GrafanaBuildVersion: "11.0.0", UploadTimestamp: time.Now().Truncate(time.Second), LatestResourceVersion: 10})
		require.Error(t, err)
		require.Contains(t, err.Error(), "write quota exceeded")
	})

	t.Run("meta.json read error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, readAllErr: fmt.Errorf("access denied")})

		_, err := store.DownloadIndex(ctx, ns, "snap-001", t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "access denied")
	})

	t.Run("file download error cleans up partial files", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		uploadSnapshot(t, real)
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, downloadErr: fmt.Errorf("connection reset")})

		destDir := t.TempDir()
		_, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
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
		uploadSnapshot(t, real)
		store := NewRemoteIndexStore(&errorBucket{CDKBucket: real, deleteErr: fmt.Errorf("permission denied")})

		err := store.DeleteIndex(ctx, ns, "snap-001")
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})
}

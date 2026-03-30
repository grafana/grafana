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

	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"
	"gocloud.dev/blob/memblob"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func newTestNsResource() resource.NamespacedResource {
	return resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
}

func setupTestFiles(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for name, content := range files {
		path := filepath.Join(dir, name)
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0750))
		require.NoError(t, os.WriteFile(path, []byte(content), 0600))
	}
}

func TestRemoteIndexStore_UploadDownloadRoundTrip(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Create local index files
	srcDir := t.TempDir()
	files := map[string]string{
		"index_meta.json": `{"some":"data"}`,
		"store/root.bolt": "bolt-data-here",
		"00000001.zap":    "segment-data-1",
		"00000002.zap":    "segment-data-2",
	}
	setupTestFiles(t, srcDir, files)

	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 42,
	}

	// Upload
	err := store.UploadIndex(ctx, ns, "snap-001", srcDir, meta)
	require.NoError(t, err)

	// Download to new dir
	destDir := t.TempDir()
	gotMeta, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
	require.NoError(t, err)

	// Verify meta
	require.Equal(t, meta.GrafanaBuildVersion, gotMeta.GrafanaBuildVersion)
	require.Equal(t, meta.LatestResourceVersion, gotMeta.LatestResourceVersion)
	require.Len(t, gotMeta.Files, len(files))

	// Verify file contents
	for name, content := range files {
		got, err := os.ReadFile(filepath.Join(destDir, name)) //nolint:gosec // test code with controlled paths
		require.NoError(t, err, "reading %s", name)
		require.Equal(t, content, string(got), "content mismatch for %s", name)
	}
}

func TestRemoteIndexStore_ListIndexes(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Upload two snapshots
	for _, key := range []string{"snap-001", "snap-002"} {
		srcDir := t.TempDir()
		setupTestFiles(t, srcDir, map[string]string{
			"index_meta.json": `{"some":"data"}`,
			"00000001.zap":    "segment-data",
		})
		meta := IndexMeta{
			GrafanaBuildVersion:   "11.0.0",
			UploadTimestamp:       time.Now().Truncate(time.Second),
			LatestResourceVersion: 10,
		}
		require.NoError(t, store.UploadIndex(ctx, ns, key, srcDir, meta))
	}

	indexes, err := store.ListIndexes(ctx, ns)
	require.NoError(t, err)
	require.Len(t, indexes, 2)
	require.Contains(t, indexes, "snap-001")
	require.Contains(t, indexes, "snap-002")
}

func TestRemoteIndexStore_DeleteIndex(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := t.TempDir()
	setupTestFiles(t, srcDir, map[string]string{
		"index_meta.json": `{"some":"data"}`,
		"00000001.zap":    "segment-data",
	})
	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 10,
	}
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	// Delete
	require.NoError(t, store.DeleteIndex(ctx, ns, "snap-001"))

	// List should be empty
	indexes, err := store.ListIndexes(ctx, ns)
	require.NoError(t, err)
	require.Empty(t, indexes)
}

func TestRemoteIndexStore_DownloadRejectsPathTraversal(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Upload normally first
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

	// Tamper with meta.json to include a path traversal entry
	pfx := indexPrefix(ns, "snap-001")

	// Re-read the uploaded meta to get the real Files map, then inject traversal
	metaRaw, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(metaRaw, &meta))
	meta.Files["../../../etc/passwd"] = 100
	metaBytes, err := json.Marshal(meta)
	require.NoError(t, err)
	require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", metaBytes, nil))

	destDir := t.TempDir()
	_, err = store.DownloadIndex(ctx, ns, "snap-001", destDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), "path traversal")
}

func TestRemoteIndexStore_RejectsInvalidIndexKey(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	srcDir := t.TempDir()
	setupTestFiles(t, srcDir, map[string]string{"file.zap": "data"})
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

	srcDir := t.TempDir()
	setupTestFiles(t, srcDir, map[string]string{
		"00000001.zap": "segment-data",
	})

	// Create a symlink pointing outside the snapshot directory
	externalFile := filepath.Join(t.TempDir(), "secret.txt")
	require.NoError(t, os.WriteFile(externalFile, []byte("secret"), 0600))
	require.NoError(t, os.Symlink(externalFile, filepath.Join(srcDir, "sneaky.zap")))

	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 10,
	}
	// Upload succeeds — symlinks are silently skipped, not uploaded.
	err := store.UploadIndex(ctx, ns, "snap-001", srcDir, meta)
	require.NoError(t, err)

	// Read back the manifest and verify only the regular file is listed.
	pfx := indexPrefix(ns, "snap-001")
	metaBytes, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	var uploaded IndexMeta
	require.NoError(t, json.Unmarshal(metaBytes, &uploaded))
	require.Len(t, uploaded.Files, 1)
	require.Contains(t, uploaded.Files, "00000001.zap")
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
		destDir := t.TempDir()
		_, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "reading meta.json")
	})

	t.Run("invalid JSON", func(t *testing.T) {
		require.NoError(t, bucket.WriteAll(ctx, pfx+"meta.json", []byte("{not json"), nil))
		destDir := t.TempDir()
		_, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
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

	// Upload normally first
	srcDir := t.TempDir()
	setupTestFiles(t, srcDir, map[string]string{
		"index_meta.json": `{"some":"data"}`,
		"00000001.zap":    "segment-data",
	})
	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 10,
	}
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	// Delete one of the data files from the bucket to simulate partial upload
	pfx := indexPrefix(ns, "snap-001")
	require.NoError(t, bucket.Delete(ctx, pfx+"00000001.zap"))

	// Download should fail because a file is missing from the bucket
	destDir := t.TempDir()
	_, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
	require.Error(t, err)
	require.Contains(t, err.Error(), "downloading")
}

// errorBucket wraps a real CDKBucket and injects errors on specific operations.
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

func TestRemoteIndexStore_UploadExcludesMetaJSON(t *testing.T) {
	ctx := context.Background()
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()
	store := NewRemoteIndexStore(bucket)
	ns := newTestNsResource()

	// Source dir contains a pre-existing meta.json that should be excluded.
	srcDir := t.TempDir()
	setupTestFiles(t, srcDir, map[string]string{
		"00000001.zap": "segment-data",
		"meta.json":    `{"stale":"data"}`,
	})

	meta := IndexMeta{
		GrafanaBuildVersion:   "11.0.0",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 10,
	}
	require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", srcDir, meta))

	// The manifest should only list the zap file, not the pre-existing meta.json.
	pfx := indexPrefix(ns, "snap-001")
	metaBytes, err := bucket.ReadAll(ctx, pfx+"meta.json")
	require.NoError(t, err)
	var uploaded IndexMeta
	require.NoError(t, json.Unmarshal(metaBytes, &uploaded))
	require.Len(t, uploaded.Files, 1)
	require.Contains(t, uploaded.Files, "00000001.zap")
	require.NotContains(t, uploaded.Files, "meta.json")

	// Round-trip download should succeed.
	destDir := t.TempDir()
	_, err = store.DownloadIndex(ctx, ns, "snap-001", destDir)
	require.NoError(t, err)
}

func TestRemoteIndexStore_BucketErrors(t *testing.T) {
	ctx := context.Background()
	ns := newTestNsResource()

	newSrcDir := func(t *testing.T) string {
		t.Helper()
		dir := t.TempDir()
		setupTestFiles(t, dir, map[string]string{"00000001.zap": "segment-data"})
		return dir
	}

	newMeta := func() IndexMeta {
		return IndexMeta{
			GrafanaBuildVersion:   "11.0.0",
			UploadTimestamp:       time.Now().Truncate(time.Second),
			LatestResourceVersion: 10,
		}
	}

	// Upload a valid snapshot to the real bucket for download/list/delete tests.
	uploadSnapshot := func(t *testing.T, bucket *blob.Bucket) {
		t.Helper()
		store := NewRemoteIndexStore(bucket)
		require.NoError(t, store.UploadIndex(ctx, ns, "snap-001", newSrcDir(t), newMeta()))
	}

	t.Run("UploadIndex fails on file upload error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		bucket := &errorBucket{CDKBucket: real, uploadErr: fmt.Errorf("upload network timeout")}
		store := NewRemoteIndexStore(bucket)

		err := store.UploadIndex(ctx, ns, "snap-001", newSrcDir(t), newMeta())
		require.Error(t, err)
		require.Contains(t, err.Error(), "uploading")
		require.Contains(t, err.Error(), "upload network timeout")
	})

	t.Run("UploadIndex fails on meta.json write error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		bucket := &errorBucket{CDKBucket: real, writeAllErr: fmt.Errorf("write quota exceeded")}
		store := NewRemoteIndexStore(bucket)

		err := store.UploadIndex(ctx, ns, "snap-001", newSrcDir(t), newMeta())
		require.Error(t, err)
		require.Contains(t, err.Error(), "uploading meta.json")
		require.Contains(t, err.Error(), "write quota exceeded")
	})

	t.Run("DownloadIndex fails on meta.json read error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		bucket := &errorBucket{CDKBucket: real, readAllErr: fmt.Errorf("access denied")}
		store := NewRemoteIndexStore(bucket)

		_, err := store.DownloadIndex(ctx, ns, "snap-001", t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "reading meta.json")
		require.Contains(t, err.Error(), "access denied")
	})

	t.Run("DownloadIndex fails on file download error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		uploadSnapshot(t, real)
		bucket := &errorBucket{CDKBucket: real, downloadErr: fmt.Errorf("connection reset")}
		store := NewRemoteIndexStore(bucket)

		destDir := t.TempDir()
		_, err := store.DownloadIndex(ctx, ns, "snap-001", destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "downloading")
		require.Contains(t, err.Error(), "connection reset")

		// Partial file should be cleaned up.
		entries, _ := os.ReadDir(destDir)
		for _, e := range entries {
			require.True(t, e.IsDir(), "no partial files should remain: %s", e.Name())
		}
	})

	t.Run("DeleteIndex fails on delete error", func(t *testing.T) {
		real := memblob.OpenBucket(nil)
		defer func() { _ = real.Close() }()
		uploadSnapshot(t, real)
		bucket := &errorBucket{CDKBucket: real, deleteErr: fmt.Errorf("permission denied")}
		store := NewRemoteIndexStore(bucket)

		err := store.DeleteIndex(ctx, ns, "snap-001")
		require.Error(t, err)
		require.Contains(t, err.Error(), "delete")
		require.Contains(t, err.Error(), "permission denied")
	})
}

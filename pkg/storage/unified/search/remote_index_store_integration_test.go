package search

import (
	"context"
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
	_ "gocloud.dev/blob/s3blob"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Integration tests for RemoteIndexStore.
//
// fileblob tests always run.
//
// Set CDK_TEST_BUCKET_URL to also run against a real provider:
//
//	CDK_TEST_BUCKET_URL=s3://my-test-bucket?region=us-east-1 go test ./pkg/storage/unified/search/... -run TestIntegration -v
//	CDK_TEST_BUCKET_URL=gs://my-test-bucket go test ./pkg/storage/unified/search/... -run TestIntegration -v
//	CDK_TEST_BUCKET_URL=azblob://my-test-container go test ./pkg/storage/unified/search/... -run TestIntegration -v

type testIndexBucketSetup struct {
	name    string
	bucket  *blob.Bucket
	cleanup func()
}

func integrationIndexBuckets(t *testing.T) []testIndexBucketSetup {
	t.Helper()
	var setups []testIndexBucketSetup

	// fileblob — always available.
	dir := t.TempDir()
	fb, err := fileblob.OpenBucket(dir, nil)
	require.NoError(t, err)
	setups = append(setups, testIndexBucketSetup{
		name:    "fileblob",
		bucket:  fb,
		cleanup: func() { _ = fb.Close() },
	})

	// Real provider — when CDK_TEST_BUCKET_URL is set.
	if bucketURL := os.Getenv("CDK_TEST_BUCKET_URL"); bucketURL != "" {
		ctx := context.Background()
		rb, err := blob.OpenBucket(ctx, bucketURL)
		require.NoError(t, err)
		setups = append(setups, testIndexBucketSetup{
			name:    "remote:" + bucketURL,
			bucket:  rb,
			cleanup: func() { _ = rb.Close() },
		})
	}

	return setups
}

func newIntegrationNsResource() resource.NamespacedResource {
	return resource.NamespacedResource{
		Namespace: "integration-test",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
}

func newIntegrationSrcDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	setupTestFiles(t, dir, map[string]string{
		"index_meta.json": `{"storage_type":"boltdb","storage_version":"15"}`,
		"store/root.bolt": "bolt-data-for-integration-test",
		"00000001.zap":    "segment-data-1",
		"00000002.zap":    "segment-data-2",
	})
	return dir
}

func newIntegrationMeta() IndexMeta {
	return IndexMeta{
		GrafanaBuildVersion:   "11.0.0-integration-test",
		UploadTimestamp:       time.Now().Truncate(time.Second),
		LatestResourceVersion: 42,
	}
}

func TestIntegrationRemoteIndexStore_UploadDownloadRoundTrip(t *testing.T) {
	for _, setup := range integrationIndexBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newIntegrationNsResource()
			indexKey := "integ-roundtrip"

			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			srcDir := newIntegrationSrcDir(t)
			meta := newIntegrationMeta()

			// Upload
			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir, meta))

			// Download to new dir
			destDir := t.TempDir()
			gotMeta, err := store.DownloadIndex(ctx, ns, indexKey, destDir)
			require.NoError(t, err)

			// Verify meta
			assert.Equal(t, meta.GrafanaBuildVersion, gotMeta.GrafanaBuildVersion)
			assert.Equal(t, meta.LatestResourceVersion, gotMeta.LatestResourceVersion)
			assert.Len(t, gotMeta.Files, 4)

			// Verify file contents match source
			srcFiles := map[string]string{
				"index_meta.json": `{"storage_type":"boltdb","storage_version":"15"}`,
				"store/root.bolt": "bolt-data-for-integration-test",
				"00000001.zap":    "segment-data-1",
				"00000002.zap":    "segment-data-2",
			}
			for name, expected := range srcFiles {
				got, err := os.ReadFile(filepath.Join(destDir, name))
				require.NoError(t, err, "reading %s", name)
				assert.Equal(t, expected, string(got), "content mismatch for %s", name)
			}

			// Cleanup
			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))
		})
	}
}

func TestIntegrationRemoteIndexStore_ListIndexes(t *testing.T) {
	for _, setup := range integrationIndexBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newIntegrationNsResource()

			keys := []string{"integ-list-001", "integ-list-002", "integ-list-003"}
			for _, key := range keys {
				key := key
				t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, key) })
			}

			// Upload multiple snapshots
			for _, key := range keys {
				srcDir := newIntegrationSrcDir(t)
				meta := newIntegrationMeta()
				require.NoError(t, store.UploadIndex(ctx, ns, key, srcDir, meta))
			}

			// List
			indexes, err := store.ListIndexes(ctx, ns)
			require.NoError(t, err)
			assert.Len(t, indexes, 3)
			for _, key := range keys {
				assert.Contains(t, indexes, key)
			}

			// Cleanup
			for _, key := range keys {
				require.NoError(t, store.DeleteIndex(ctx, ns, key))
			}

			// List again — should be empty
			indexes, err = store.ListIndexes(ctx, ns)
			require.NoError(t, err)
			assert.Empty(t, indexes)
		})
	}
}

func TestIntegrationRemoteIndexStore_DeleteIndex(t *testing.T) {
	for _, setup := range integrationIndexBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newIntegrationNsResource()
			indexKey := "integ-delete"

			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			srcDir := newIntegrationSrcDir(t)
			meta := newIntegrationMeta()
			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir, meta))

			// Delete
			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))

			// List should not contain deleted snapshot
			indexes, err := store.ListIndexes(ctx, ns)
			require.NoError(t, err)
			assert.NotContains(t, indexes, indexKey)

			// Download should fail (meta.json gone)
			_, err = store.DownloadIndex(ctx, ns, indexKey, t.TempDir())
			require.Error(t, err)
		})
	}
}

// createTestBleveIndex creates a real bleve index with sample documents and returns the index directory.
func createTestBleveIndex(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "bleve-index")

	idx, err := bleve.New(dir, bleve.NewIndexMapping())
	require.NoError(t, err)

	// Index some documents
	docs := map[string]map[string]string{
		"dash-1": {"title": "Production Overview", "folder": "ops"},
		"dash-2": {"title": "API Latency", "folder": "ops"},
		"dash-3": {"title": "Frontend Errors", "folder": "frontend"},
	}
	for id, doc := range docs {
		require.NoError(t, idx.Index(id, doc))
	}

	// Verify documents are searchable before closing
	count, err := idx.DocCount()
	require.NoError(t, err)
	require.Equal(t, uint64(3), count)

	require.NoError(t, idx.Close())
	return dir
}

func TestIntegrationRemoteIndexStore_BleveRoundTrip(t *testing.T) {
	for _, setup := range integrationIndexBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newIntegrationNsResource()
			indexKey := "integ-bleve"

			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			// Create a real bleve index with documents
			srcDir := createTestBleveIndex(t)

			meta := IndexMeta{
				GrafanaBuildVersion:   "11.0.0-bleve-test",
				UploadTimestamp:       time.Now().Truncate(time.Second),
				LatestResourceVersion: 99,
			}

			// Upload the real index
			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir, meta))

			// Download to a new directory
			destDir := filepath.Join(t.TempDir(), "downloaded-index")
			gotMeta, err := store.DownloadIndex(ctx, ns, indexKey, destDir)
			require.NoError(t, err)
			assert.Equal(t, "11.0.0-bleve-test", gotMeta.GrafanaBuildVersion)
			assert.Equal(t, int64(99), gotMeta.LatestResourceVersion)

			// Open the downloaded index with bleve and verify it's functional
			idx, err := bleve.Open(destDir)
			require.NoError(t, err)

			// Verify document count
			count, err := idx.DocCount()
			require.NoError(t, err)
			assert.Equal(t, uint64(3), count)

			// Verify search works
			query := bleve.NewMatchQuery("Production")
			result, err := idx.Search(bleve.NewSearchRequest(query))
			require.NoError(t, err)
			assert.Equal(t, uint64(1), result.Total)
			assert.Equal(t, "dash-1", result.Hits[0].ID)

			// Verify a broader search
			query2 := bleve.NewMatchQuery("ops")
			result2, err := idx.Search(bleve.NewSearchRequest(query2))
			require.NoError(t, err)
			assert.Equal(t, uint64(2), result2.Total)

			// Cleanup
			require.NoError(t, idx.Close())
			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))
		})
	}
}

func TestIntegrationRemoteIndexStore_OverwriteSnapshot(t *testing.T) {
	for _, setup := range integrationIndexBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			store := NewRemoteIndexStore(setup.bucket)
			ctx := context.Background()
			ns := newIntegrationNsResource()
			indexKey := "integ-overwrite"

			t.Cleanup(func() { _ = store.DeleteIndex(ctx, ns, indexKey) })

			// Upload v1
			srcDir1 := newIntegrationSrcDir(t)
			meta1 := newIntegrationMeta()
			meta1.LatestResourceVersion = 100
			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir1, meta1))

			// Upload v2 to same key (overwrite)
			srcDir2 := t.TempDir()
			setupTestFiles(t, srcDir2, map[string]string{
				"index_meta.json": `{"storage_type":"boltdb","storage_version":"16"}`,
				"store/root.bolt": "updated-bolt-data",
				"00000001.zap":    "updated-segment",
			})
			meta2 := newIntegrationMeta()
			meta2.LatestResourceVersion = 200
			require.NoError(t, store.UploadIndex(ctx, ns, indexKey, srcDir2, meta2))

			// Download and verify v2 content
			destDir := t.TempDir()
			gotMeta, err := store.DownloadIndex(ctx, ns, indexKey, destDir)
			require.NoError(t, err)
			assert.Equal(t, int64(200), gotMeta.LatestResourceVersion)
			assert.Len(t, gotMeta.Files, 3) // v2 has 3 files

			got, err := os.ReadFile(filepath.Join(destDir, "store/root.bolt"))
			require.NoError(t, err)
			assert.Equal(t, "updated-bolt-data", string(got))

			// Cleanup
			require.NoError(t, store.DeleteIndex(ctx, ns, indexKey))
		})
	}
}

package search

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/memblob"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// TestBleveBackend_SnapshotRoundTrip exercises the full download path end to
// end against an in-memory bucket. The first backend builds an index and
// uploads it via the already-merged store.UploadIndex API. A fresh backend
// (new local Root, same bucket) then calls BuildIndex and is expected to
// download the snapshot instead of invoking the builder.
func TestBleveBackend_SnapshotRoundTrip(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })

	store := NewBucketRemoteIndexStore(bucket)
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	const docCount int64 = 10
	const wantRV int64 = 123

	// Phase 1: build an index locally. FileThreshold=5 forces a file-based index.
	buildReg := prometheus.NewRegistry()
	buildMetrics := resource.ProvideIndexMetrics(buildReg)
	be1, err := NewBleveBackend(BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5,
		BuildVersion:  "11.5.0",
	}, buildMetrics)
	require.NoError(t, err)

	idx1, err := be1.BuildIndex(ctx, key, docCount, nil, "initial", func(idx resource.ResourceIndex) (int64, error) {
		return wantRV, idx.BulkIndex(&resource.BulkIndexRequest{Items: makeDocs(key, docCount)})
	}, nil, false, time.Time{})
	require.NoError(t, err)
	require.NotNil(t, idx1)

	// Close the first backend so bleve releases the bolt lock before we copy its files.
	resourceDir := be1.getResourceDir(key)
	be1.Stop()

	// Locate the one-and-only built index directory under resourceDir.
	builtDir := onlyIndexSubdir(t, resourceDir)

	meta := IndexMeta{
		GrafanaBuildVersion:   "11.5.0",
		LatestResourceVersion: wantRV,
		UploadTimestamp:       time.Now(),
	}
	_, err = store.UploadIndex(ctx, key, builtDir, meta)
	require.NoError(t, err)

	// Phase 2: fresh backend with an empty local Root pointing at the same bucket.
	downloadReg := prometheus.NewRegistry()
	downloadMetrics := resource.ProvideIndexMetrics(downloadReg)
	be2, err := NewBleveBackend(BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5,
		BuildVersion:  "11.5.0",
		Snapshot: SnapshotOptions{
			Store:       store,
			MinDocCount: 5,
			MaxIndexAge: 24 * time.Hour,
		},
	}, downloadMetrics)
	require.NoError(t, err)
	t.Cleanup(be2.Stop)

	var builderCalled atomic.Bool
	idx2, err := be2.BuildIndex(ctx, key, docCount, nil, "startup", func(resource.ResourceIndex) (int64, error) {
		builderCalled.Store(true)
		return 0, nil
	}, nil, false, time.Time{})
	require.NoError(t, err)
	require.NotNil(t, idx2)

	assert.False(t, builderCalled.Load(), "builder should not be called when a remote snapshot is available")

	// Download-success counter ticked exactly once.
	assert.Equal(t, 1.0,
		testutil.ToFloat64(downloadMetrics.IndexSnapshotDownloads.WithLabelValues("success")),
		"expected one successful snapshot download",
	)
	// Build was skipped (the downloaded snapshot reused existing bleve files).
	assert.Equal(t, 1.0, testutil.ToFloat64(downloadMetrics.IndexBuildSkipped))

	// The downloaded index reports the RV embedded in the uploaded snapshot.
	bi, ok := idx2.(*bleveIndex)
	require.True(t, ok, "BuildIndex should return *bleveIndex in this test path")
	assert.Equal(t, wantRV, bi.resourceVersion.Load())
}

// makeDocs generates a minimal set of indexable documents.
func makeDocs(key resource.NamespacedResource, n int64) []*resource.BulkIndexItem {
	items := make([]*resource.BulkIndexItem, 0, n)
	for i := int64(0); i < n; i++ {
		name := "doc-" + strconv.FormatInt(i, 10)
		items = append(items, &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:   i + 1,
				Name: name,
				Key: &resourcepb.ResourceKey{
					Name:      name,
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				},
				Title: "Doc " + strconv.FormatInt(i, 10),
			},
		})
	}
	return items
}

// onlyIndexSubdir asserts there's exactly one subdirectory under dir and returns its absolute path.
func onlyIndexSubdir(t *testing.T, dir string) string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	require.NoError(t, err)
	var subdirs []string
	for _, e := range entries {
		if e.IsDir() {
			subdirs = append(subdirs, filepath.Join(dir, e.Name()))
		}
	}
	require.Len(t, subdirs, 1, "expected exactly one built index directory in %s", dir)
	return subdirs[0]
}

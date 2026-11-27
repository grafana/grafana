package search

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestUpdateMemoryIndexSizeMetrics(t *testing.T) {
	backend, reg := setupBleveBackend(t)
	// Drive refreshes explicitly so the background loop cannot overwrite assertions.
	backend.bgTasksCancel()
	backend.bgTasksWg.Wait()

	checkMetrics := func(total, largest uint64) {
		t.Helper()
		backend.updateMemoryIndexSizeMetrics(t.Context())
		require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(fmt.Sprintf(`
			# HELP grafana_index_server_memory_index_size_bytes Estimated memory used by all open in-memory Bleve indexes, including partially obsolete segments.
			# TYPE grafana_index_server_memory_index_size_bytes gauge
			grafana_index_server_memory_index_size_bytes %d
			# HELP grafana_index_server_memory_index_max_size_bytes Largest estimated memory used by a single open in-memory Bleve index, including partially obsolete segments.
			# TYPE grafana_index_server_memory_index_max_size_bytes gauge
			grafana_index_server_memory_index_max_size_bytes %d
		`, total, largest)), "grafana_index_server_memory_index_size_bytes", "grafana_index_server_memory_index_max_size_bytes"))
	}
	build := func(namespace string, docs int) *bleveIndex {
		t.Helper()
		key := resource.NamespacedResource{Namespace: namespace, Group: "group", Resource: "resource"}
		idx, err := backend.BuildIndex(t.Context(), key, int64(docs), "test", indexTestDocs(key, docs, 100), nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
		require.NoError(t, err)
		return idx.(*bleveIndex)
	}
	snapshotSize := func(idx *bleveIndex) (uint64, int64) {
		t.Helper()
		advanced, err := idx.index.Advanced()
		require.NoError(t, err)
		reader, err := advanced.Reader()
		require.NoError(t, err)
		defer func() { require.NoError(t, reader.Close()) }()
		snapshot := reader.(*scorch.IndexSnapshot)
		var obsolete int64
		for _, segment := range snapshot.Segments() {
			obsolete += segment.FullSize() - segment.LiveSize()
		}
		return uint64(snapshot.Size()), obsolete
	}

	checkMetrics(0, 0)
	first := build("first", 1)
	second := build("second", 2)
	file := build("file", defaultFileThreshold)
	require.Equal(t, indexStorageMemory, first.indexStorage)
	require.Equal(t, indexStorageMemory, second.indexStorage)
	require.Equal(t, indexStorageFile, file.indexStorage)

	// Rewriting one document leaves its old version in a partially live segment.
	_, err := indexTestDocs(second.key, 1, 101)(second)
	require.NoError(t, err)
	firstSize, _ := snapshotSize(first)
	secondSize, obsolete := snapshotSize(second)
	require.Positive(t, firstSize)
	require.Positive(t, secondSize)
	require.Equal(t, int64(1), obsolete)

	lastSearch := time.Unix(1, 0)
	for _, idx := range []*bleveIndex{first, second, file} {
		require.Same(t, idx, backend.getIndexForSearch(idx.key, lastSearch))
	}
	checkMetrics(firstSize+secondSize, max(firstSize, secondSize))
	checkMetrics(firstSize+secondSize, max(firstSize, secondSize))
	for _, idx := range []*bleveIndex{first, second, file} {
		require.Equal(t, lastSearch.UnixMilli(), idx.lastFetchedFromCache.Load())
		require.Equal(t, lastSearch.UnixMilli(), idx.lastSearchedAt.Load())
	}

	backend.cacheMx.Lock()
	delete(backend.cache, second.key)
	backend.cacheMx.Unlock()
	backend.closeIndex(second, second.key)
	checkMetrics(firstSize, firstSize)

	backend.closeAllIndexes()
	checkMetrics(0, 0)
}

func TestUpdateIndexSizeMetric(t *testing.T) {
	for _, mode := range []os.FileMode{0o700, 0o000} {
		t.Run(mode.String(), func(t *testing.T) {
			if mode == 0 && os.Geteuid() == 0 {
				t.Skip("root can read directories without read permissions")
			}

			root := t.TempDir()
			lostFound := filepath.Join(root, "lost+found")
			require.NoError(t, os.Mkdir(lostFound, 0o700))
			require.NoError(t, os.WriteFile(filepath.Join(lostFound, "recovered"), []byte("not an index"), 0o600))
			require.NoError(t, os.Chmod(lostFound, mode))
			t.Cleanup(func() {
				// Directory traversal must be restored so TempDir cleanup can remove its contents.
				require.NoError(t, os.Chmod(lostFound, 0o700)) //nolint:gosec // G302: Owner-only directory permissions are required for cleanup.
			})

			// Only the filesystem's top-level recovery directory should be skipped.
			index := filepath.Join(root, "index", "lost+found")
			require.NoError(t, os.MkdirAll(index, 0o700))
			require.NoError(t, os.WriteFile(filepath.Join(index, "data"), []byte("index data"), 0o600))

			logger := &logtest.Fake{}
			backend := &bleveBackend{
				log:          logger,
				indexMetrics: resource.ProvideIndexMetrics(nil),
			}
			backend.indexMetrics.IndexSize.Set(99)
			backend.updateIndexSizeMetric(context.Background(), root)
			require.Equal(t, float64(len("index data")), testutil.ToFloat64(backend.indexMetrics.IndexSize))
			require.Zero(t, logger.ErrorLogs.Calls)
		})
	}

	t.Run("regular file named lost+found is counted", func(t *testing.T) {
		root := t.TempDir()
		require.NoError(t, os.WriteFile(filepath.Join(root, "lost+found"), []byte("index data"), 0o600))
		backend := &bleveBackend{
			log:          &logtest.Fake{},
			indexMetrics: resource.ProvideIndexMetrics(nil),
		}
		backend.updateIndexSizeMetric(context.Background(), root)
		require.Equal(t, float64(len("index data")), testutil.ToFloat64(backend.indexMetrics.IndexSize))
	})

	t.Run("unrelated walk errors preserve the previous value", func(t *testing.T) {
		logger := &logtest.Fake{}
		backend := &bleveBackend{
			log:          logger,
			indexMetrics: resource.ProvideIndexMetrics(nil),
		}
		backend.indexMetrics.IndexSize.Set(99)
		backend.updateIndexSizeMetric(context.Background(), filepath.Join(t.TempDir(), "missing"))
		require.Equal(t, 99.0, testutil.ToFloat64(backend.indexMetrics.IndexSize))
		require.Equal(t, 1, logger.ErrorLogs.Calls)
	})
}

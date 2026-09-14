package search

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestUpdateIndexedKindsMetric(t *testing.T) {
	be, metrics := newTestBleveBackend(t, SnapshotOptions{})

	// The background refresh is the only caller in production, so stop it and drive
	// the refresh from the test instead.
	be.bgTasksCancel()
	be.bgTasksWg.Wait()

	key := newTestNsResource()
	otherNamespace := key
	otherNamespace.Namespace = "other"

	// Each test index holds a single document.
	newCachedUploadTestIndex(t, be, key, 1)
	newCachedUploadTestIndex(t, be, otherNamespace, 1)

	expected := `
		# HELP index_server_indexed_kinds Number of indexed documents by kind
		# TYPE index_server_indexed_kinds gauge
		index_server_indexed_kinds{kind="dashboards"} 2
	`

	be.updateIndexedKindsMetric()
	require.NoError(t, testutil.CollectAndCompare(metrics.IndexedKinds, strings.NewReader(expected)))

	// Refreshing again must not add to the previous value.
	be.updateIndexedKindsMetric()
	require.NoError(t, testutil.CollectAndCompare(metrics.IndexedKinds, strings.NewReader(expected)))

	// A closed index must not leave its count behind.
	closeCachedIndexes(t, be)
	be.updateIndexedKindsMetric()
	require.Equal(t, 0, testutil.CollectAndCount(metrics.IndexedKinds))
}

func closeCachedIndexes(t *testing.T, be *bleveBackend) {
	t.Helper()

	be.cacheMx.Lock()
	defer be.cacheMx.Unlock()

	for key, idx := range be.cache {
		require.NoError(t, idx.stopUpdaterAndCloseIndex())
		delete(be.cache, key)
	}
}

package search

import (
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

	// Each index holds one live document and one deleted one kept for trash search.
	buildIndexedKindsTestIndex(t, be, key)
	buildIndexedKindsTestIndex(t, be, otherNamespace)

	// Live and deleted documents are counted separately, one of each per index.
	expected := `
		# HELP index_server_indexed_kinds Number of indexed documents by kind. Live documents and deleted ones the index keeps so they can be found in trash are reported separately.
		# TYPE index_server_indexed_kinds gauge
		index_server_indexed_kinds{kind="dashboards",state="live"} 2
		index_server_indexed_kinds{kind="dashboards",state="deleted"} 2
	`

	be.updateIndexedKindsMetric(t.Context())
	require.NoError(t, testutil.CollectAndCompare(metrics.IndexedKinds, strings.NewReader(expected)))

	// Refreshing again must not add to the previous value.
	be.updateIndexedKindsMetric(t.Context())
	require.NoError(t, testutil.CollectAndCompare(metrics.IndexedKinds, strings.NewReader(expected)))

	// A closed index must not leave its count behind.
	closeCachedIndexes(t, be)
	be.updateIndexedKindsMetric(t.Context())
	require.Equal(t, 0, testutil.CollectAndCount(metrics.IndexedKinds))
}

func buildIndexedKindsTestIndex(t *testing.T, be *bleveBackend, key resource.NamespacedResource) {
	t.Helper()

	doc := func(name string, deleted *bool) *resource.BulkIndexItem {
		return &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				Key:       &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name},
				Title:     name,
				IsDeleted: deleted,
			},
		}
	}

	_, err := be.BuildIndex(t.Context(), key, 2, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				doc("live", nil),
				doc("trashed", new(true)),
			},
		})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
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

package search_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

// Only the index knows what its write accepted, so it is the index that counts
// the documents and bytes that reached it.
func TestBleveRecordsIndexPhaseMetrics(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := resource.ProvideIndexMetrics(reg)

	backend, key := newPhaseMetricsBackend(t, metrics, 0)

	writer := func(index resource.ResourceIndex) (int64, error) {
		return 3, index.BulkIndex(&resource.BulkIndexRequest{
			Path:  resource.IndexPathBuild,
			Items: phaseMetricsItems(key, 3),
		})
	}

	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "ns"})
	_, err := backend.BuildIndex(ctx, key, 3, "test", writer, nil, true, time.Time{}, 0)
	require.NoError(t, err)

	labels := []string{resource.IndexPathBuild, key.Group, key.Resource}
	require.Equal(t, 3.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{resource.IndexPhaseCommit}, labels...)...)),
		"documents the write accepted")
	require.Positive(t, testutil.ToFloat64(metrics.BuildIndexedBytes.WithLabelValues(labels...)),
		"bytes the index reports for them")
	require.Positive(t, testutil.ToFloat64(metrics.BuildPhaseSeconds.WithLabelValues(append([]string{resource.IndexPhaseCommit}, labels...)...)),
		"writing the batch took time")
}

// An index that stays in memory never moves to disk, so it must not report time
// in a phase that only covers moving it.
func TestBleveDoesNotRecordPromoteWithoutPromotion(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := resource.ProvideIndexMetrics(reg)

	// A threshold far above the document count keeps the index in memory.
	backend, key := newPhaseMetricsBackend(t, metrics, 1000)

	writer := func(index resource.ResourceIndex) (int64, error) {
		return 3, index.BulkIndex(&resource.BulkIndexRequest{
			Path:  resource.IndexPathBuild,
			Items: phaseMetricsItems(key, 3),
		})
	}

	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "ns"})
	_, err := backend.BuildIndex(ctx, key, 3, "test", writer, nil, true, time.Time{}, 0)
	require.NoError(t, err)

	promote := testutil.ToFloat64(metrics.BuildPhaseSeconds.WithLabelValues(resource.IndexPhasePromote, resource.IndexPathBuild, key.Group, key.Resource))
	require.Zero(t, promote, "nothing was promoted")
}

func newPhaseMetricsBackend(t *testing.T, metrics *resource.BleveIndexMetrics, fileThreshold int64) (resource.SearchBackend, resource.NamespacedResource) {
	t.Helper()

	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: fileThreshold,
		BuildVersion:  "12.3.45-789",
		SearchFields: resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
			resource.NewLowerGroupResource("dashboard.grafana.app", "dashboards"): search.DashboardSearchFieldsProviderForTest(),
		}),
	}, metrics)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	return backend, resource.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
}

func phaseMetricsItems(key resource.NamespacedResource, count int) []*resource.BulkIndexItem {
	items := make([]*resource.BulkIndexItem, 0, count)
	for i := range count {
		name := fmt.Sprintf("name%d", i)
		items = append(items, &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:    int64(i),
				Name:  name,
				Key:   &resourcepb.ResourceKey{Name: name, Namespace: key.Namespace, Group: key.Group, Resource: key.Resource},
				Title: name + "-title",
			},
		})
	}
	return items
}

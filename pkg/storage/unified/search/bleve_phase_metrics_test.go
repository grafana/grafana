package search_test

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	searchmetrics "github.com/grafana/grafana/pkg/storage/unified/search/metrics"

	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

// Only the index knows what its write accepted, so it is the index that counts
// the documents and bytes that reached it.
func TestBleveRecordsIndexPhaseMetrics(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := searchmetrics.ProvideBleveMetrics(reg, nil)

	backend, key := newPhaseMetricsBackend(t, metrics, 0)

	writer := func(index searchmodel.ResourceIndex) (int64, error) {
		return 3, index.BulkIndex(&searchmodel.BulkIndexRequest{
			Path:  searchmetrics.IndexPathBuild,
			Items: phaseMetricsItems(key, 3),
		})
	}

	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "ns"})
	_, err := backend.BuildIndex(ctx, key, 3, "test", writer, nil, true, time.Time{}, 0)
	require.NoError(t, err)

	labels := []string{searchmetrics.IndexPathBuild, key.Group, key.Resource}
	require.Equal(t, 3.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(append([]string{searchmetrics.IndexPhaseCommit}, labels...)...)),
		"documents the write accepted")
	require.Positive(t, testutil.ToFloat64(metrics.BuildIndexedBytes.WithLabelValues(labels...)),
		"bytes the index reports for them")
	require.Positive(t, testutil.ToFloat64(metrics.BuildPhaseSeconds.WithLabelValues(append([]string{searchmetrics.IndexPhaseCommit}, labels...)...)),
		"writing the batch took time")
}

// An index that stays in memory never moves to disk, so it must not report time
// in a phase that only covers moving it.
func TestBleveDoesNotRecordPromoteWithoutPromotion(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	metrics := searchmetrics.ProvideBleveMetrics(reg, nil)

	// A threshold far above the document count keeps the index in memory.
	backend, key := newPhaseMetricsBackend(t, metrics, 1000)

	writer := func(index searchmodel.ResourceIndex) (int64, error) {
		return 3, index.BulkIndex(&searchmodel.BulkIndexRequest{
			Path:  searchmetrics.IndexPathBuild,
			Items: phaseMetricsItems(key, 3),
		})
	}

	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "ns"})
	_, err := backend.BuildIndex(ctx, key, 3, "test", writer, nil, true, time.Time{}, 0)
	require.NoError(t, err)

	promote := testutil.ToFloat64(metrics.BuildPhaseSeconds.WithLabelValues(searchmetrics.IndexPhasePromote, searchmetrics.IndexPathBuild, key.Group, key.Resource))
	require.Zero(t, promote, "nothing was promoted")
}

func newPhaseMetricsBackend(t *testing.T, metrics *searchmetrics.BleveMetrics, fileThreshold int64) (searchmodel.SearchBackend, resourcecontract.NamespacedResource) {
	t.Helper()

	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: fileThreshold,
		BuildVersion:  "12.3.45-789",
		SearchFields: searchmodel.NewSearchFieldsRegistry(nil, nil, map[resourcecontract.LowerGroupResource]searchmodel.SearchFieldsProvider{
			resourcecontract.NewLowerGroupResource("dashboard.grafana.app", "dashboards"): search.DashboardSearchFieldsProviderForTest(),
		}),
	}, metrics)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	return backend, resourcecontract.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
}

func phaseMetricsItems(key resourcecontract.NamespacedResource, count int) []*searchmodel.BulkIndexItem {
	items := make([]*searchmodel.BulkIndexItem, 0, count)
	for i := range count {
		name := fmt.Sprintf("name%d", i)
		items = append(items, &searchmodel.BulkIndexItem{
			Action: searchmodel.ActionIndex,
			Doc: &searchmodel.IndexableDocument{
				RV:    int64(i),
				Name:  name,
				Key:   &resourcepb.ResourceKey{Name: name, Namespace: key.Namespace, Group: key.Group, Resource: key.Resource},
				Title: name + "-title",
			},
		})
	}
	return items
}

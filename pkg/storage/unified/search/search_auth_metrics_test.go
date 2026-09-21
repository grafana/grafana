package search_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func newAuthMetricsIndex(t *testing.T, postRank bool, cfg search.PostRankAuthzConfig) (resource.ResourceIndex, *resource.SearchAuthMetrics) {
	t.Helper()
	metrics := resource.ProvideIndexMetrics(prometheus.NewRegistry())
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root: t.TempDir(), FileThreshold: threshold, IndexDeletedDocuments: true,
		PostRankAuthzEnabled: postRank, PostRankAuthz: cfg,
		SearchFields: resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
			resource.NewLowerGroupResource("dashboard.grafana.app", "dashboards"): search.DashboardSearchFieldsProviderForTest(),
		}),
	}, metrics)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)
	index, err := backend.BuildIndex(context.Background(), postRankKey, 100, "test", noop, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	for i := range 100 {
		indexDocs(t, index, []*resource.BulkIndexItem{newDocWithTags(fmt.Sprintf("doc-%03d", i), "allowed", []string{"tag"})})
	}
	return index, metrics.SearchAuth
}

func authHistogram(t *testing.T, vec *prometheus.HistogramVec, labels ...string) *dto.Histogram {
	t.Helper()
	metric := &dto.Metric{}
	require.NoError(t, vec.WithLabelValues(labels...).(prometheus.Metric).Write(metric))
	return metric.GetHistogram()
}

func TestSearchAuthMetricsModes(t *testing.T) {
	for _, mode := range []string{"pre_rank", "post_rank", "none"} {
		t.Run(mode, func(t *testing.T) {
			index, metrics := newAuthMetricsIndex(t, mode != "pre_rank", search.PostRankAuthzConfig{})
			client := &countingAccessClient{allowAll: true}
			var access authlib.AccessClient = client
			if mode == "none" {
				access = nil
			}
			names, _ := searchNames(t, index, access, listQuery(10))
			require.Len(t, names, 10)
			require.EqualValues(t, 1, authHistogram(t, metrics.Duration, mode, "page", "success").GetSampleCount())
			require.EqualValues(t, 10, authHistogram(t, metrics.Returned, mode, "page").GetSampleSum())
			require.EqualValues(t, client.checked, authHistogram(t, metrics.Checks, mode, "page").GetSampleSum())
			require.EqualValues(t, client.batchChecks, authHistogram(t, metrics.Calls, mode, "page", "batch_check").GetSampleSum())
			require.EqualValues(t, client.checked, authHistogram(t, metrics.Candidates, mode, "page").GetSampleSum())
			switch mode {
			case "pre_rank":
				require.Equal(t, 100, client.checked)
			case "post_rank":
				require.Positive(t, client.checked)
				require.Less(t, client.checked, 100, "PostRank must stop before authorizing the entire result set")
			case "none":
				require.Zero(t, client.checked)
			}
		})
	}
}

func TestSearchAuthMetricsBudgets(t *testing.T) {
	for _, facets := range []bool{false, true} {
		t.Run(fmt.Sprintf("facets=%v", facets), func(t *testing.T) {
			index, metrics := newAuthMetricsIndex(t, true, search.PostRankAuthzConfig{MaxCandidates: 20, FacetSampleSize: 20})
			client := &countingAccessClient{allowAll: true}
			query := listQuery(0)
			kind, reason := "count", "candidate_budget"
			if facets {
				query = listQuery(10)
				query.Facet = map[string]*resourcepb.ResourceSearchRequest_Facet{"tags": {Field: "tags", Limit: 10}}
				kind, reason = "facets", "facet_budget"
			}
			_, response := searchNames(t, index, client, query)
			require.False(t, response.TotalHitsExact)
			require.EqualValues(t, 1, testutil.ToFloat64(metrics.Events.WithLabelValues(reason)))
			require.EqualValues(t, client.checked, authHistogram(t, metrics.Candidates, "post_rank", kind).GetSampleSum(), "include both facet and page authorization passes")
			require.EqualValues(t, 1, authHistogram(t, metrics.Duration, "post_rank", kind, "success").GetSampleCount())
		})
	}
}

type failingSearchAccessClient struct{ authlib.AccessClient }

func (failingSearchAccessClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, errors.New("authz unavailable")
}

func TestSearchAuthMetricsFailure(t *testing.T) {
	for _, mode := range []string{"pre_rank", "post_rank"} {
		t.Run(mode, func(t *testing.T) {
			index, metrics := newAuthMetricsIndex(t, mode == "post_rank", search.PostRankAuthzConfig{})
			requester := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 1, Namespace: postRankKey.Namespace}
			ctx := authlib.WithAuthInfo(context.Background(), requester)
			_, err := index.Search(ctx, failingSearchAccessClient{}, listQuery(10), nil, nil)
			require.Error(t, err)
			require.EqualValues(t, 1, authHistogram(t, metrics.Duration, mode, "page", "error").GetSampleCount())
			require.Positive(t, authHistogram(t, metrics.Checks, mode, "page").GetSampleSum())
			require.Positive(t, authHistogram(t, metrics.Candidates, mode, "page").GetSampleSum())
			require.Zero(t, authHistogram(t, metrics.Returned, mode, "page").GetSampleCount())
		})
	}
}

func TestSearchAuthMetricsCursorFallback(t *testing.T) {
	index, metrics := newAuthMetricsIndex(t, true, search.PostRankAuthzConfig{})
	query := listQuery(10)
	query.SearchAfter = []string{"doc-000", "doc-000"}
	_, response := searchNames(t, index, &countingAccessClient{allowAll: true}, query)
	require.NotNil(t, response)
	require.EqualValues(t, 1, testutil.ToFloat64(metrics.Events.WithLabelValues("cursor_fallback")))
	require.EqualValues(t, 1, authHistogram(t, metrics.Duration, "pre_rank", "page", "success").GetSampleCount())
	require.Zero(t, authHistogram(t, metrics.Duration, "post_rank", "page", "success").GetSampleCount())
}

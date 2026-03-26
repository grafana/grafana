package metrics

import (
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeQuery(refID, subscription, region, namespace, metricNames, interval, aggregation string, from, to time.Time, dims []dataquery.AzureMetricDimension, resources map[string]dataquery.AzureMonitorResource) *types.AzureMonitorQuery {
	params := url.Values{}
	params.Set("region", region)
	params.Set("metricnamespace", namespace)
	params.Set("metricnames", metricNames)
	params.Set("interval", interval)
	params.Set("aggregation", aggregation)
	return &types.AzureMonitorQuery{
		RefID:        refID,
		Subscription: subscription,
		Params:       params,
		TimeRange:    backend.TimeRange{From: from, To: to},
		Dimensions:   dims,
		Resources:    resources,
	}
}

func TestGroupQueriesForBatch(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	later := now.Add(time.Hour)

	t.Run("single query produces one group", func(t *testing.T) {
		q := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q})
		require.Len(t, groups, 1)
		assert.Len(t, groups[0].Queries, 1)
	})

	t.Run("two queries with same parameters produce one group", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		require.Len(t, groups, 1)
		assert.Len(t, groups[0].Queries, 2)
	})

	t.Run("queries with different regions produce separate groups", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub1", "eastus", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		assert.Len(t, groups, 2)
	})

	t.Run("queries with different subscriptions produce separate groups", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub2", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		assert.Len(t, groups, 2)
	})

	t.Run("queries with different metric names produce separate groups", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Available Memory Bytes", "PT1M", "Average", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		assert.Len(t, groups, 2)
	})

	t.Run("queries with different namespaces produce separate groups", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Storage/storageAccounts", "Transactions", "PT1M", "Average", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		assert.Len(t, groups, 2)
	})

	t.Run("queries with different time ranges produce separate groups", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later.Add(time.Hour), nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		assert.Len(t, groups, 2)
	})

	t.Run("queries with different aggregations produce separate groups", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Maximum", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		assert.Len(t, groups, 2)
	})

	t.Run("queries with different dimension filters produce separate groups", func(t *testing.T) {
		dim1 := []dataquery.AzureMetricDimension{{Dimension: strPtr("VMName"), Operator: strPtr("eq"), Filters: []string{"vm1"}}}
		dim2 := []dataquery.AzureMetricDimension{{Dimension: strPtr("VMName"), Operator: strPtr("eq"), Filters: []string{"vm2"}}}
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, dim1, nil)
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, dim2, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		assert.Len(t, groups, 2)
	})

	t.Run("queries with same dimension filters are grouped together", func(t *testing.T) {
		dim := []dataquery.AzureMetricDimension{{Dimension: strPtr("VMName"), Operator: strPtr("eq"), Filters: []string{"vm1"}}}
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, dim, nil)
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, dim, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2})
		require.Len(t, groups, 1)
		assert.Len(t, groups[0].Queries, 2)
	})

	t.Run("empty input produces empty output", func(t *testing.T) {
		groups := groupQueriesForBatch(nil)
		assert.Empty(t, groups)
	})

	t.Run("group order follows first appearance of key", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q2 := makeQuery("B", "sub1", "eastus", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		q3 := makeQuery("C", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil, nil)
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2, q3})
		require.Len(t, groups, 2)
		assert.Equal(t, "westus2", groups[0].Key.Region)
		assert.Equal(t, "eastus", groups[1].Key.Region)
		assert.Len(t, groups[0].Queries, 2) // q1 and q3
	})
}

func TestResourceIDsForGroup(t *testing.T) {
	res1 := map[string]dataquery.AzureMonitorResource{
		"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm1": {},
	}
	res2 := map[string]dataquery.AzureMonitorResource{
		"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm2": {},
	}
	res3 := map[string]dataquery.AzureMonitorResource{
		"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm1": {},
		"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm3": {},
	}

	q1 := &types.AzureMonitorQuery{RefID: "A", Resources: res1, Params: url.Values{}}
	q2 := &types.AzureMonitorQuery{RefID: "B", Resources: res2, Params: url.Values{}}
	q3 := &types.AzureMonitorQuery{RefID: "C", Resources: res3, Params: url.Values{}}

	group := BatchQueryGroup{Queries: []*types.AzureMonitorQuery{q1, q2, q3}}
	ids := resourceIDsForGroup(group)

	assert.Len(t, ids, 3) // vm1 deduplicated
	assert.Equal(t, []string{
		"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm1",
		"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm2",
		"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm3",
	}, ids)
}

func TestDimensionFilterKey(t *testing.T) {
	t.Run("no dimensions returns empty string", func(t *testing.T) {
		q := &types.AzureMonitorQuery{Params: url.Values{}}
		assert.Equal(t, "", dimensionFilterKey(q))
	})

	t.Run("single dimension returns filter string", func(t *testing.T) {
		q := &types.AzureMonitorQuery{
			Params: url.Values{},
			Dimensions: []dataquery.AzureMetricDimension{
				{Dimension: strPtr("VMName"), Operator: strPtr("eq"), Filters: []string{"vm1"}},
			},
		}
		assert.Equal(t, "VMName eq 'vm1'", dimensionFilterKey(q))
	})

	t.Run("multiple dimensions are sorted for stable key", func(t *testing.T) {
		q1 := &types.AzureMonitorQuery{
			Params: url.Values{},
			Dimensions: []dataquery.AzureMetricDimension{
				{Dimension: strPtr("VMName"), Operator: strPtr("eq"), Filters: []string{"vm1"}},
				{Dimension: strPtr("ResourceGroup"), Operator: strPtr("eq"), Filters: []string{"rg1"}},
			},
		}
		q2 := &types.AzureMonitorQuery{
			Params: url.Values{},
			Dimensions: []dataquery.AzureMetricDimension{
				{Dimension: strPtr("ResourceGroup"), Operator: strPtr("eq"), Filters: []string{"rg1"}},
				{Dimension: strPtr("VMName"), Operator: strPtr("eq"), Filters: []string{"vm1"}},
			},
		}
		// Both orderings should produce the same key
		assert.Equal(t, dimensionFilterKey(q1), dimensionFilterKey(q2))
	})
}

func makeResources(ids ...string) map[string]dataquery.AzureMonitorResource {
	m := make(map[string]dataquery.AzureMonitorResource, len(ids))
	for _, id := range ids {
		m[id] = dataquery.AzureMonitorResource{}
	}
	return m
}

func TestCreateBatches(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	later := now.Add(time.Hour)

	t.Run("single group with few resources produces one batch", func(t *testing.T) {
		q := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources("/sub/rg/vm1", "/sub/rg/vm2"))
		groups := groupQueriesForBatch([]*types.AzureMonitorQuery{q})
		batches := createBatches(groups)
		require.Len(t, batches, 1)
		assert.Len(t, batches[0].ResourceIDs, 2)
		assert.Len(t, batches[0].Queries, 1)
	})

	t.Run("group with exactly 50 resources produces one batch", func(t *testing.T) {
		ids := make([]string, 50)
		for i := range ids {
			ids[i] = fmt.Sprintf("/sub/rg/vm%03d", i)
		}
		q := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources(ids...))
		batches := createBatches(groupQueriesForBatch([]*types.AzureMonitorQuery{q}))
		require.Len(t, batches, 1)
		assert.Len(t, batches[0].ResourceIDs, 50)
	})

	t.Run("group with 51 resources produces two batches", func(t *testing.T) {
		ids := make([]string, 51)
		for i := range ids {
			ids[i] = fmt.Sprintf("/sub/rg/vm%03d", i)
		}
		q := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources(ids...))
		batches := createBatches(groupQueriesForBatch([]*types.AzureMonitorQuery{q}))
		require.Len(t, batches, 2)
		assert.Len(t, batches[0].ResourceIDs, 50)
		assert.Len(t, batches[1].ResourceIDs, 1)
	})

	t.Run("group with 100 resources produces two batches of 50", func(t *testing.T) {
		ids := make([]string, 100)
		for i := range ids {
			ids[i] = fmt.Sprintf("/sub/rg/vm%03d", i)
		}
		q := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources(ids...))
		batches := createBatches(groupQueriesForBatch([]*types.AzureMonitorQuery{q}))
		require.Len(t, batches, 2)
		assert.Len(t, batches[0].ResourceIDs, 50)
		assert.Len(t, batches[1].ResourceIDs, 50)
	})

	t.Run("two groups produce independent batches", func(t *testing.T) {
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources("/sub/rg/vm1"))
		q2 := makeQuery("B", "sub1", "eastus", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources("/sub/rg/vm2"))
		batches := createBatches(groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2}))
		require.Len(t, batches, 2)
		assert.Equal(t, "westus2", batches[0].Key.Region)
		assert.Equal(t, "eastus", batches[1].Key.Region)
	})

	t.Run("each batch includes only the queries owning resources in that batch", func(t *testing.T) {
		// Use zero-padded IDs so lexicographic sort matches numeric order.
		// q1 owns vm00..vm49, q2 owns vm50.
		ids1 := make([]string, 50)
		for i := range ids1 {
			ids1[i] = fmt.Sprintf("/sub/rg/vm%02d", i)
		}
		q1 := makeQuery("A", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources(ids1...))
		q2 := makeQuery("B", "sub1", "westus2", "Microsoft.Compute/virtualMachines", "Percentage CPU", "PT1M", "Average", now, later, nil,
			makeResources("/sub/rg/vm50"))
		batches := createBatches(groupQueriesForBatch([]*types.AzureMonitorQuery{q1, q2}))
		require.Len(t, batches, 2)
		assert.Equal(t, []*types.AzureMonitorQuery{q1}, batches[0].Queries)
		assert.Equal(t, []*types.AzureMonitorQuery{q2}, batches[1].Queries)
	})

	t.Run("empty groups produce no batches", func(t *testing.T) {
		batches := createBatches(nil)
		assert.Empty(t, batches)
	})
}

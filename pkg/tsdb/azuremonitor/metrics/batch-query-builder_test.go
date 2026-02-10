package metrics

import (
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupQueriesIntoBatches(t *testing.T) {
	t.Run("should group queries with same parameters", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: time.Now().Add(-1 * time.Hour),
			To:   time.Now(),
		}

		queries := []*types.AzureMonitorQuery{
			{
				URL:          "/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1/providers/microsoft.insights/metrics",
				RefID:        "A",
				TimeRange:    timeRange,
				Subscription: "sub1",
				Params: url.Values{
					"metricnamespace": []string{"Microsoft.Compute/virtualMachines"},
					"metricnames":     []string{"Percentage CPU"},
					"interval":        []string{"PT1M"},
					"aggregation":     []string{"Average"},
				},
				Resources: map[string]dataquery.AzureMonitorResource{
					"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm1": {},
				},
			},
			{
				URL:          "/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm2/providers/microsoft.insights/metrics",
				RefID:        "B",
				TimeRange:    timeRange,
				Subscription: "sub1",
				Params: url.Values{
					"metricnamespace": []string{"Microsoft.Compute/virtualMachines"},
					"metricnames":     []string{"Percentage CPU"},
					"interval":        []string{"PT1M"},
					"aggregation":     []string{"Average"},
				},
				Resources: map[string]dataquery.AzureMonitorResource{
					"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm2": {},
				},
			},
		}

		batches := groupQueriesIntoBatches(queries)

		require.Len(t, batches, 1, "should create one batch for queries with same parameters")
		assert.Len(t, batches[0].ResourceIds, 2, "batch should contain 2 resources")
		assert.Len(t, batches[0].Queries, 2, "batch should contain 2 queries")
	})

	t.Run("should split batch when exceeding max size", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: time.Now().Add(-1 * time.Hour),
			To:   time.Now(),
		}

		// Create 51 queries to test splitting
		queries := []*types.AzureMonitorQuery{}
		for i := 0; i < 51; i++ {
			resourceId := "/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm" + string(rune(i))
			queries = append(queries, &types.AzureMonitorQuery{
				URL:          resourceId + "/providers/microsoft.insights/metrics",
				RefID:        string(rune(i)),
				TimeRange:    timeRange,
				Subscription: "sub1",
				Params: url.Values{
					"metricnamespace": []string{"Microsoft.Compute/virtualMachines"},
					"metricnames":     []string{"Percentage CPU"},
					"interval":        []string{"PT1M"},
					"aggregation":     []string{"Average"},
				},
				Resources: map[string]dataquery.AzureMonitorResource{
					resourceId: {},
				},
			})
		}

		batches := groupQueriesIntoBatches(queries)

		require.GreaterOrEqual(t, len(batches), 2, "should split into at least 2 batches")
		totalResources := 0
		for _, batch := range batches {
			totalResources += len(batch.ResourceIds)
			assert.LessOrEqual(t, len(batch.ResourceIds), 50, "each batch should have at most 50 resources")
		}
		assert.Equal(t, 51, totalResources, "total resources should be 51")
	})

	t.Run("should create separate batches for different metrics", func(t *testing.T) {
		timeRange := backend.TimeRange{
			From: time.Now().Add(-1 * time.Hour),
			To:   time.Now(),
		}

		queries := []*types.AzureMonitorQuery{
			{
				URL:          "/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1/providers/microsoft.insights/metrics",
				RefID:        "A",
				TimeRange:    timeRange,
				Subscription: "sub1",
				Params: url.Values{
					"metricnamespace": []string{"Microsoft.Compute/virtualMachines"},
					"metricnames":     []string{"Percentage CPU"},
					"interval":        []string{"PT1M"},
					"aggregation":     []string{"Average"},
				},
				Resources: map[string]dataquery.AzureMonitorResource{
					"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm1": {},
				},
			},
			{
				URL:          "/subscriptions/sub1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1/providers/microsoft.insights/metrics",
				RefID:        "B",
				TimeRange:    timeRange,
				Subscription: "sub1",
				Params: url.Values{
					"metricnamespace": []string{"Microsoft.Compute/virtualMachines"},
					"metricnames":     []string{"Network In Total"},
					"interval":        []string{"PT1M"},
					"aggregation":     []string{"Average"},
				},
				Resources: map[string]dataquery.AzureMonitorResource{
					"/subscriptions/sub1/resourcegroups/rg1/providers/microsoft.compute/virtualmachines/vm1": {},
				},
			},
		}

		batches := groupQueriesIntoBatches(queries)

		require.Len(t, batches, 2, "should create separate batches for different metrics")
	})
}

func TestPartitionQueries(t *testing.T) {
	t.Run("should partition custom metrics as non-batchable", func(t *testing.T) {
		queries := []*types.AzureMonitorQuery{
			{
				RefID: "A",
				Params: url.Values{
					"metricnamespace": []string{"Microsoft.Compute/virtualMachines"},
				},
			},
			{
				RefID: "B",
				Params: url.Values{
					"metricnamespace": []string{"CustomMetrics"},
				},
			},
		}

		batchable, nonBatchable := partitionQueries(queries)

		assert.Len(t, batchable, 1, "should have 1 batchable query")
		assert.Len(t, nonBatchable, 1, "should have 1 non-batchable query")
		assert.Equal(t, "B", nonBatchable[0].RefID, "custom metrics should be non-batchable")
	})
}

func TestIsBatchableQuery(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		expected  bool
	}{
		{
			name:      "standard namespace is batchable",
			namespace: "Microsoft.Compute/virtualMachines",
			expected:  true,
		},
		{
			name:      "custom metrics are not batchable",
			namespace: "CustomMetrics",
			expected:  false,
		},
		{
			name:      "guest metrics are not batchable",
			namespace: "Microsoft.Compute/virtualMachines/guest",
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := &types.AzureMonitorQuery{
				Params: url.Values{
					"metricnamespace": []string{tt.namespace},
				},
			}

			result := isBatchableQuery(query)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBuildBatchURL(t *testing.T) {
	batch := &types.BatchQueryGroup{
		Region:       "eastus",
		Subscription: "sub-123",
		Namespace:    "Microsoft.Compute/virtualMachines",
		MetricNames:  []string{"Percentage CPU"},
		TimeRange: backend.TimeRange{
			From: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC),
			To:   time.Date(2023, 1, 1, 1, 0, 0, 0, time.UTC),
		},
		Interval:    "PT1M",
		Aggregation: "Average",
	}

	url := buildBatchURL(batch.Region, batch.Subscription, batch.Namespace, batch)

	assert.Contains(t, url, "eastus.metrics.monitor.azure.com", "should use regional endpoint")
	assert.Contains(t, url, "sub-123", "should include subscription")
	assert.Contains(t, url, "metrics:getBatch", "should use batch endpoint")
	assert.Contains(t, url, "api-version=2023-10-01", "should use batch API version")
	assert.Contains(t, url, "metricnamespace=Microsoft.Compute%2FvirtualMachines", "should include namespace")
}

func TestGetRegionalEndpoint(t *testing.T) {
	tests := []struct {
		name     string
		region   string
		expected string
	}{
		{
			name:     "eastus region",
			region:   "eastus",
			expected: "eastus.metrics.monitor.azure.com",
		},
		{
			name:     "empty region uses global",
			region:   "",
			expected: "global.metrics.monitor.azure.com",
		},
		{
			name:     "global region",
			region:   "global",
			expected: "global.metrics.monitor.azure.com",
		},
		{
			name:     "region with spaces",
			region:   "East US",
			expected: "eastus.metrics.monitor.azure.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getRegionalEndpoint(tt.region)
			assert.Equal(t, tt.expected, result)
		})
	}
}

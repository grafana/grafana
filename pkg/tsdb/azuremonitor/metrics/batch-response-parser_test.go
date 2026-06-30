package metrics

import (
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	aztypes "github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// helpers

func makeTimeseriesData(avg float64) []aztypes.AzureMetricTimeseriesData {
	return []aztypes.AzureMetricTimeseriesData{
		{TimeStamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), Average: &avg},
	}
}

func makeResourceValue(resourceID, namespace, region string, errorCode string, avg float64) batchResponseValue {
	ec := errorCode
	if ec == "" {
		ec = "Success"
	}
	return batchResponseValue{
		ResourceID:     resourceID,
		Namespace:      namespace,
		ResourceRegion: region,
		Interval:       "PT1M",
		Value: []batchMetric{
			{
				AzureMetricValue: aztypes.AzureMetricValue{
					Name:       aztypes.AzureMetricName{Value: "Percentage CPU", LocalizedValue: "Percentage CPU"},
					Unit:       "Percent",
					Timeseries: []aztypes.AzureMetricTimeseries{{Data: makeTimeseriesData(avg)}},
				},
				ErrorCode: ec,
			},
		},
	}
}

func makeQueryWithResources(refID string, resources map[string]dataquery.AzureMonitorResource) *aztypes.AzureMonitorQuery {
	params := url.Values{}
	params.Set("aggregation", "Average")
	return &aztypes.AzureMonitorQuery{
		RefID:        refID,
		Subscription: "sub-123",
		Params:       params,
		TimeRange:    backend.TimeRange{From: time.Now(), To: time.Now().Add(time.Hour)},
		Resources:    resources,
	}
}

// TestFramesFromBatchResponseValue

func TestFramesFromBatchResponseValue(t *testing.T) {
	q := makeQueryWithResources("A", map[string]dataquery.AzureMonitorResource{
		"/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1": {},
	})

	t.Run("produces one frame per timeseries", func(t *testing.T) {
		rv := makeResourceValue("/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1",
			"microsoft.compute/virtualmachines", "westus2", "Success", 42.0)

		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		require.Len(t, frames, 1)
	})

	t.Run("frame has correct RefID", func(t *testing.T) {
		rv := makeResourceValue("/sub/rg/vm1", "ns", "westus2", "Success", 1.0)
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		assert.Equal(t, "A", frames[0].RefID)
	})

	t.Run("frame has time and value fields", func(t *testing.T) {
		rv := makeResourceValue("/sub/rg/vm1", "ns", "westus2", "Success", 55.5)
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		require.Len(t, frames[0].Fields, 2)
		assert.Equal(t, data.TimeSeriesTimeFieldName, frames[0].Fields[0].Name)
		assert.Equal(t, "Percentage CPU", frames[0].Fields[1].Name)
	})

	t.Run("resourceName label is set from last path segment", func(t *testing.T) {
		rv := makeResourceValue("/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/myVM",
			"ns", "westus2", "Success", 1.0)
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		assert.Equal(t, "myVM", frames[0].Fields[1].Labels["resourceName"])
	})

	t.Run("unit is mapped to Grafana unit", func(t *testing.T) {
		rv := makeResourceValue("/sub/rg/vm1", "ns", "westus2", "Success", 1.0)
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		require.NotNil(t, frames[0].Fields[1].Config)
		assert.Equal(t, "percent", frames[0].Fields[1].Config.Unit)
	})

	t.Run("aggregation selects correct data point field", func(t *testing.T) {
		params := url.Values{}
		params.Set("aggregation", "Maximum")
		qMax := &aztypes.AzureMonitorQuery{RefID: "A", Params: params, Resources: q.Resources}

		maxVal := 99.0
		rv := batchResponseValue{
			ResourceID: "/sub/rg/vm1",
			Value: []batchMetric{{
				AzureMetricValue: aztypes.AzureMetricValue{
					Name: aztypes.AzureMetricName{LocalizedValue: "Percentage CPU"},
					Unit: "Unspecified",
					Timeseries: []aztypes.AzureMetricTimeseries{{
						Data: []aztypes.AzureMetricTimeseriesData{
							{TimeStamp: time.Now(), Maximum: &maxVal},
						},
					}},
				},
				ErrorCode: "Success",
			}},
		}
		frames, err := framesFromBatchResponseValue(rv, qMax, "https://portal.azure.com")
		require.NoError(t, err)
		val, ok := frames[0].Fields[1].ConcreteAt(0)
		require.True(t, ok)
		assert.InDelta(t, 99.0, val.(float64), 0.001)
	})

	t.Run("returns error for non-Success errorCode", func(t *testing.T) {
		rv := makeResourceValue("/sub/rg/vm1", "ns", "westus2", "ResourceNotFound", 0)
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "ResourceNotFound")
		assert.Empty(t, frames)
	})

	t.Run("partial metric error: returns frames for successful metrics and error for failed ones", func(t *testing.T) {
		avg := 42.0
		rv := batchResponseValue{
			ResourceID: "/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1",
			Value: []batchMetric{
				{
					AzureMetricValue: aztypes.AzureMetricValue{
						Name:       aztypes.AzureMetricName{Value: "Percentage CPU", LocalizedValue: "Percentage CPU"},
						Unit:       "Unspecified",
						Timeseries: []aztypes.AzureMetricTimeseries{{Data: []aztypes.AzureMetricTimeseriesData{{TimeStamp: time.Now(), Average: &avg}}}},
					},
					ErrorCode: "Success",
				},
				{
					AzureMetricValue: aztypes.AzureMetricValue{
						Name: aztypes.AzureMetricName{Value: "Disk Read Bytes", LocalizedValue: "Disk Read Bytes"},
						Unit: "Unspecified",
					},
					ErrorCode: "ResourceNotFound",
				},
			},
		}
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Disk Read Bytes")
		assert.Len(t, frames, 1, "frame from successful metric should be preserved")
		assert.Equal(t, "Percentage CPU", frames[0].Fields[1].Name)
	})

	t.Run("returns nil frames for empty value array", func(t *testing.T) {
		rv := batchResponseValue{ResourceID: "/sub/rg/vm1"}
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		assert.Empty(t, frames)
	})

	t.Run("dimension metadata values become frame labels", func(t *testing.T) {
		rv := batchResponseValue{
			ResourceID: "/sub/rg/vm1",
			Value: []batchMetric{{
				AzureMetricValue: aztypes.AzureMetricValue{
					Name: aztypes.AzureMetricName{LocalizedValue: "Percentage CPU"},
					Unit: "Unspecified",
					Timeseries: []aztypes.AzureMetricTimeseries{{
						Metadatavalues: []aztypes.AzureMetricMetadataValue{
							{Name: aztypes.AzureMetricName{LocalizedValue: "VMName"}, Value: "myvm"},
						},
						Data: makeTimeseriesData(1.0),
					}},
				},
				ErrorCode: "Success",
			}},
		}
		frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		assert.Equal(t, "myvm", frames[0].Fields[1].Labels["VMName"])
	})
}

// TestFramesFromBatchResponseValueGrafanaSql verifies the batch path applies the
// same GrafanaSql frame reshaping (time/value/resourceName columns) as the
// single-resource parseResponse, so SQL-over-metrics queries work under batch.
func TestFramesFromBatchResponseValueGrafanaSql(t *testing.T) {
	q := makeQueryWithResources("A", map[string]dataquery.AzureMonitorResource{
		"/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/myvm": {},
	})
	q.GrafanaSql = true

	rv := makeResourceValue("/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/myVM",
		"microsoft.compute/virtualmachines", "westus2", "Success", 42.0)

	frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
	require.NoError(t, err)
	require.Len(t, frames, 1)

	f := frames[0]
	require.Len(t, f.Fields, 3, "grafanaSql frame should have time, value, resourceName columns")
	require.Equal(t, "time", f.Fields[0].Name)
	require.Equal(t, "value", f.Fields[1].Name)
	require.Equal(t, "resourceName", f.Fields[2].Name)
	// resourceName preserves the canonical casing from the resource ID.
	require.Equal(t, "myVM", f.Fields[2].At(0))
}

// framesForRefID returns the subset of frames whose RefID matches.
func framesForRefID(frames data.Frames, refID string) data.Frames {
	var out data.Frames
	for _, f := range frames {
		if f.RefID == refID {
			out = append(out, f)
		}
	}
	return out
}

// TestParseBatchResponse

func TestParseBatchResponse(t *testing.T) {
	resourceID := "/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"
	q := makeQueryWithResources("A", map[string]dataquery.AzureMonitorResource{resourceID: {}})

	t.Run("routes response to correct query by resource ID", func(t *testing.T) {
		result := batchResult{
			Batch: Batch{Queries: []*aztypes.AzureMonitorQuery{q}},
			Response: &batchResponse{
				Values: []batchResponseValue{
					makeResourceValue(resourceID, "ns", "westus2", "Success", 1.0),
				},
			},
		}
		frames, _ := parseBatchResponse(result, "https://portal.azure.com")
		assert.Len(t, framesForRefID(frames, "A"), 1)
	})

	t.Run("resource IDs are matched case-insensitively", func(t *testing.T) {
		result := batchResult{
			Batch: Batch{Queries: []*aztypes.AzureMonitorQuery{q}},
			Response: &batchResponse{
				Values: []batchResponseValue{
					// Response returns mixed-case ID; query stores lowercase
					makeResourceValue("/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1",
						"ns", "westus2", "Success", 1.0),
				},
			},
		}
		frames, _ := parseBatchResponse(result, "https://portal.azure.com")
		assert.Len(t, framesForRefID(frames, "A"), 1)
	})

	t.Run("unknown resource ID is skipped", func(t *testing.T) {
		result := batchResult{
			Batch: Batch{Queries: []*aztypes.AzureMonitorQuery{q}},
			Response: &batchResponse{
				Values: []batchResponseValue{
					makeResourceValue("/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/unknown",
						"ns", "westus2", "Success", 1.0),
				},
			},
		}
		frames, _ := parseBatchResponse(result, "https://portal.azure.com")
		assert.Empty(t, frames)
	})

	t.Run("multiple resources for the same query produce multiple frames", func(t *testing.T) {
		id1 := "/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"
		id2 := "/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm2"
		qMulti := makeQueryWithResources("A", map[string]dataquery.AzureMonitorResource{id1: {}, id2: {}})

		result := batchResult{
			Batch: Batch{Queries: []*aztypes.AzureMonitorQuery{qMulti}},
			Response: &batchResponse{
				Values: []batchResponseValue{
					makeResourceValue(id1, "ns", "westus2", "Success", 1.0),
					makeResourceValue(id2, "ns", "westus2", "Success", 2.0),
				},
			},
		}
		frames, _ := parseBatchResponse(result, "https://portal.azure.com")
		assert.Len(t, framesForRefID(frames, "A"), 2)
	})

	t.Run("resource-level error is returned", func(t *testing.T) {
		result := batchResult{
			Batch: Batch{Queries: []*aztypes.AzureMonitorQuery{q}},
			Response: &batchResponse{
				Values: []batchResponseValue{
					makeResourceValue(resourceID, "ns", "westus2", "ResourceNotFound", 0),
				},
			},
		}
		_, err := parseBatchResponse(result, "https://portal.azure.com")
		assert.Error(t, err)
	})
}

// TestFramesFromBatchResponseValueAlias exercises the shared builder's alias /
// legend branch on the batch path (previously untested), including the minimal
// AzureMonitorResponse adapter used for {{namespace}}/{{metric}}.
func TestFramesFromBatchResponseValueAlias(t *testing.T) {
	lowerID := "/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"
	q := makeQueryWithResources("A", map[string]dataquery.AzureMonitorResource{
		lowerID: {ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1")},
	})
	q.Alias = "{{namespace}} {{resourceName}} {{metric}}"

	rv := makeResourceValue("/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1",
		"microsoft.compute/virtualmachines", "westus2", "Success", 42.0)

	frames, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
	require.NoError(t, err)
	require.Len(t, frames, 1)
	require.NotNil(t, frames[0].Fields[1].Config)
	require.Equal(t, "microsoft.compute/virtualmachines vm1 Percentage CPU", frames[0].Fields[1].Config.DisplayName)
}

// TestParseResponseLegacyBatchEquivalence is the key guard for the shared-builder
// refactor: for the same logical resource/metric/series, the single-resource ARM
// parser and the batch parser must produce equivalent frames (field names,
// labels, config, and values); for both default and GrafanaSql queries.
func TestParseResponseLegacyBatchEquivalence(t *testing.T) {
	const fullID = "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1"
	const lowerID = "/subscriptions/sub/resourcegroups/rg/providers/microsoft.compute/virtualmachines/vm1"

	build := func(grafanaSql bool) (data.Frames, data.Frames) {
		q := makeQueryWithResources("A", map[string]dataquery.AzureMonitorResource{
			lowerID: {ResourceGroup: strPtr("rg"), ResourceName: strPtr("vm1")},
		})
		q.Alias = "{{resourceName}} {{metric}}"
		q.GrafanaSql = grafanaSql

		// Legacy ARM response: the resource ID arrives as a metadata label.
		arm := aztypes.AzureMonitorResponse{
			Namespace: "microsoft.compute/virtualmachines",
			Value: []aztypes.AzureMetricValue{{
				Name: aztypes.AzureMetricName{Value: "Percentage CPU", LocalizedValue: "Percentage CPU"},
				Unit: "Percent",
				Timeseries: []aztypes.AzureMetricTimeseries{{
					Metadatavalues: []aztypes.AzureMetricMetadataValue{{
						Name:  aztypes.AzureMetricName{Value: "microsoft.resourceid", LocalizedValue: "microsoft.resourceid"},
						Value: fullID,
					}},
					Data: makeTimeseriesData(42.0),
				}},
			}},
		}
		// Equivalent batch value: the resource ID arrives as the resourceid field.
		rv := makeResourceValue(fullID, "microsoft.compute/virtualmachines", "westus2", "Success", 42.0)

		ds := &AzureMonitorDatasource{}
		legacy, err := ds.parseResponse(arm, q, "https://portal.azure.com", q.Subscription)
		require.NoError(t, err)
		batch, err := framesFromBatchResponseValue(rv, q, "https://portal.azure.com")
		require.NoError(t, err)
		return legacy, batch
	}

	for _, grafanaSql := range []bool{false, true} {
		name := "default query"
		if grafanaSql {
			name = "grafanaSql query"
		}
		t.Run(name, func(t *testing.T) {
			legacy, batch := build(grafanaSql)
			require.Len(t, legacy, 1)
			require.Len(t, batch, 1)
			assertFramesEquivalent(t, legacy[0], batch[0])
		})
	}
}

// assertFramesEquivalent checks that two frames match on the user-visible
// attributes: RefID, field names, labels, config, and row values.
func assertFramesEquivalent(t *testing.T, legacy, batch *data.Frame) {
	t.Helper()
	require.Equal(t, legacy.RefID, batch.RefID, "RefID")
	require.Equal(t, len(legacy.Fields), len(batch.Fields), "field count")
	for i := range legacy.Fields {
		lf, bf := legacy.Fields[i], batch.Fields[i]
		require.Equalf(t, lf.Name, bf.Name, "field %d name", i)
		require.Equalf(t, lf.Labels, bf.Labels, "field %d labels", i)
		require.Equalf(t, lf.Config, bf.Config, "field %d config", i)
		require.Equalf(t, lf.Len(), bf.Len(), "field %d length", i)
		for j := 0; j < lf.Len(); j++ {
			require.Equalf(t, lf.At(j), bf.At(j), "field %d row %d", i, j)
		}
	}
}

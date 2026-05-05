package azuremonitor

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
)

func TestParseSubscriptionIDFromParameter(t *testing.T) {
	guid := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	t.Run("plain guid", func(t *testing.T) {
		require.Equal(t, guid, parseSubscriptionIDFromParameter(guid))
	})
	t.Run("display label with em dash", func(t *testing.T) {
		s := "My Sub — " + guid
		require.Equal(t, guid, parseSubscriptionIDFromParameter(s))
	})
}

func TestNormalizeGrafanaSQLRequest_DisabledToggle(t *testing.T) {
	s := &Service{}
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "",
			}),
		},
		Queries: []backend.DataQuery{{
			RefID: "A",
			JSON:  []byte(`{"grafanaSql":true,"table":"microsoft.compute-virtualmachines"}`),
		}},
	}
	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Nil(t, errs)
	require.Equal(t, req, out)
}

func TestNormalizeGrafanaSQLRequest_ConvertsMetricsQuery(t *testing.T) {
	s := &Service{}
	sub := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	tp := map[string]any{
		subscription:  sub,
		metricName:    "Percentage CPU",
		aggregation:   "Average",
		resourceGroup: "rg1",
		resourceName:  "vm1",
		region:        "westeurope",
	}
	tpJSON, err := json.Marshal(tp)
	require.NoError(t, err)

	var tpMap map[string]any
	require.NoError(t, json.Unmarshal(tpJSON, &tpMap))

	sq := schemas.Query{
		Table:                "microsoft.compute-virtualmachines",
		GrafanaSql:           true,
		TableParameterValues: tpMap,
		Filters:              nil,
	}
	raw, err := json.Marshal(map[string]any{
		"refId":                "A",
		"table":                sq.Table,
		"grafanaSql":           true,
		"tableParameterValues": tp,
	})
	require.NoError(t, err)

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "ds-1"},
		},
		Queries: []backend.DataQuery{{
			RefID: "A",
			JSON:  raw,
		}},
	}

	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Nil(t, errs)
	require.Len(t, out.Queries, 1)
	require.Equal(t, azureMonitor, out.Queries[0].QueryType)

	var decoded map[string]any
	require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &decoded))
	require.Equal(t, sub, decoded["subscription"])
	am, ok := decoded["azureMonitor"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "Percentage CPU", am["metricName"])
	require.Equal(t, "Average", am["aggregation"])
	require.Equal(t, "microsoft.compute/virtualmachines", am["metricNamespace"])
	res := am["resources"].([]any)
	require.Len(t, res, 1)
	r0 := res[0].(map[string]any)
	require.Equal(t, "rg1", r0["resourceGroup"])
	require.Equal(t, "vm1", r0["resourceName"])
}

func TestNormalizeGrafanaSQLRequest_MissingAggregation(t *testing.T) {
	s := &Service{}
	raw, err := json.Marshal(map[string]any{
		"refId":      "A",
		"table":      "microsoft.compute-virtualmachines",
		"grafanaSql": true,
		"tableParameterValues": map[string]any{
			subscription: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			metricName:   "Percentage CPU",
		},
	})
	require.NoError(t, err)
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
		},
		Queries: []backend.DataQuery{{RefID: "A", JSON: raw}},
	}
	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Contains(t, errs["A"].Error(), "aggregation")
	require.Empty(t, out.Queries)
}

func TestNormalizeGrafanaSQLRequest_MissingResourceGroup(t *testing.T) {
	s := &Service{}
	raw, err := json.Marshal(map[string]any{
		"refId":      "A",
		"table":      "microsoft.compute-virtualmachines",
		"grafanaSql": true,
		"tableParameterValues": map[string]any{
			subscription: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			metricName:   "Percentage CPU",
			aggregation:  "Average",
		},
	})
	require.NoError(t, err)
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
		},
		Queries: []backend.DataQuery{{RefID: "A", JSON: raw}},
	}
	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Contains(t, errs["A"].Error(), "resourceGroup")
	require.Empty(t, out.Queries)
}

func TestNormalizeGrafanaSQLRequest_MultiResourceRequiresRegion(t *testing.T) {
	s := &Service{}
	raw, err := json.Marshal(map[string]any{
		"refId":      "A",
		"table":      "microsoft.compute-virtualmachines",
		"grafanaSql": true,
		"tableParameterValues": map[string]any{
			subscription:  "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			metricName:    "Percentage CPU",
			aggregation:   "Average",
			resourceGroup: "rg1",
		},
	})
	require.NoError(t, err)
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
		},
		Queries: []backend.DataQuery{{RefID: "A", JSON: raw}},
	}
	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Contains(t, errs["A"].Error(), "region")
	require.Empty(t, out.Queries)
}

func TestApplyMetricSQLFilters_DimensionColumn(t *testing.T) {
	az := dataquery.NewAzureMetricQuery()
	dimKey := "Microsoft.ResourceId"
	col := encodeDimensionColumnName(dimKey)
	require.Equal(t, "dimension_i_Microsoft.ResourceId", col)
	err := applyMetricSQLFilters(az, []schemas.ColumnFilter{
		{
			Name: col,
			Conditions: []schemas.FilterCondition{
				{Operator: schemas.OperatorEquals, Value: "/subscriptions/foo/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1"},
			},
		},
	})
	require.NoError(t, err)
	require.Len(t, az.DimensionFilters, 1)
	require.Equal(t, dimKey, *az.DimensionFilters[0].Dimension)
	require.Equal(t, []string{"/subscriptions/foo/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1"}, az.DimensionFilters[0].Filters)

	az2 := dataquery.NewAzureMetricQuery()
	err = applyMetricSQLFilters(az2, []schemas.ColumnFilter{
		{
			Name: col,
			Conditions: []schemas.FilterCondition{
				{Operator: schemas.OperatorIn, Values: []any{"a", "b"}},
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"a", "b"}, az2.DimensionFilters[0].Filters)
}

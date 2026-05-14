package tempo

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/stretchr/testify/require"

	schemas "github.com/grafana/schemads"
)

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
			JSON:  []byte(`{"grafanaSql":true,"table":"spans"}`),
		}},
	}
	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Nil(t, errs)
	require.Equal(t, req, out)
}

func TestNormalizeGrafanaSQLRequest_NotGrafanaSqlPassthrough(t *testing.T) {
	s := &Service{}
	orig := []byte(`{"refId":"A","queryType":"traceqlSearch","query":"{}"}`)
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
		},
		Queries: []backend.DataQuery{{
			RefID:     "A",
			QueryType: string(dataquery.TempoQueryTypeTraceqlSearch),
			JSON:      orig,
		}},
	}
	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Nil(t, errs)
	require.Len(t, out.Queries, 1)
	require.JSONEq(t, string(orig), string(out.Queries[0].JSON))
}

func TestNormalizeGrafanaSQLRequest_ConvertsSpansQuery(t *testing.T) {
	s := &Service{}
	sq := schemas.Query{
		Table:      tempoSchemadsTableSpans,
		GrafanaSql: true,
		Filters: []schemas.ColumnFilter{
			{
				Name: "resource.service.name",
				Conditions: []schemas.FilterCondition{{
					Operator: schemas.OperatorEquals,
					Value:    "api",
				}},
			},
		},
	}
	raw, err := json.Marshal(sq)
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
	require.Nil(t, errs)
	require.Len(t, out.Queries, 1)
	require.Equal(t, string(dataquery.TempoQueryTypeTraceqlSearch), out.Queries[0].QueryType)

	var model dataquery.TempoQuery
	require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
	require.NotNil(t, model.Query)
	require.Equal(t, `{resource.service.name="api"}`, *model.Query)
	require.NotNil(t, model.TableType)
	require.Equal(t, dataquery.SearchTableTypeSpans, *model.TableType)
}

func TestNormalizeGrafanaSQLRequest_UnsupportedTable(t *testing.T) {
	s := &Service{}
	sq := schemas.Query{Table: "other", GrafanaSql: true}
	raw, err := json.Marshal(sq)
	require.NoError(t, err)
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
		},
		Queries: []backend.DataQuery{{RefID: "X", JSON: raw}},
	}
	out, errs := s.normalizeGrafanaSQLRequest(context.Background(), req)
	require.Contains(t, errs["X"].Error(), "unsupported table")
	require.Empty(t, out.Queries)
}

func TestTraceQLFromSchemadsFilters_Empty(t *testing.T) {
	q, err := traceQLFromSchemadsFilters(nil)
	require.NoError(t, err)
	require.Equal(t, "{}", q)
}

func TestTraceQLFromSchemadsFilters_TimeColumnRejected(t *testing.T) {
	_, err := traceQLFromSchemadsFilters([]schemas.ColumnFilter{{
		Name: tempoSpanColTime,
		Conditions: []schemas.FilterCondition{{
			Operator: schemas.OperatorGreaterThan,
			Value:    "2024-01-01",
		}},
	}})
	require.Error(t, err)
}

func TestTraceQLFromSchemadsFilters_SpanScopeAndIntrinsic(t *testing.T) {
	q, err := traceQLFromSchemadsFilters([]schemas.ColumnFilter{
		{
			Name: "span.db",
			Conditions: []schemas.FilterCondition{{
				Operator: schemas.OperatorEquals,
				Value:    "postgres",
			}},
		},
		{
			Name: "status",
			Conditions: []schemas.FilterCondition{{
				Operator: schemas.OperatorEquals,
				Value:    float64(200),
			}},
		},
	})
	require.NoError(t, err)
	require.Equal(t, `{span.db="postgres" && status=200}`, q)
}

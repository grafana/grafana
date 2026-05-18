package loki

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	schemas "github.com/grafana/schemads"
	"github.com/stretchr/testify/require"
)

func TestBuildLogQLExpr(t *testing.T) {
	t.Parallel()

	const tbl, val = "service_name", "carts"

	tests := []struct {
		name    string
		filters []schemas.ColumnFilter
		want    string
		wantErr bool
	}{
		{
			name: "no filters",
			want: `{service_name="carts"}`,
		},
		{
			name: "equals filter",
			filters: []schemas.ColumnFilter{
				{Name: "env", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorEquals, Value: "prod"},
				}},
			},
			want: `{env="prod", service_name="carts"}`,
		},
		{
			name: "not equals",
			filters: []schemas.ColumnFilter{
				{Name: "env", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorNotEquals, Value: "dev"},
				}},
			},
			want: `{env!="dev", service_name="carts"}`,
		},
		{
			name: "like regex",
			filters: []schemas.ColumnFilter{
				{Name: "pod", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorLike, Value: ".*shop.*"},
				}},
			},
			want: `{pod=~".*shop.*", service_name="carts"}`,
		},
		{
			name: "in",
			filters: []schemas.ColumnFilter{
				{Name: "zone", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorIn, Values: []any{"a", "b"}},
				}},
			},
			want: `{service_name="carts", zone=~"^(a|b)$"}`,
		},
		{
			name: "empty in list",
			filters: []schemas.ColumnFilter{
				{Name: "zone", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorIn, Values: nil},
				}},
			},
			wantErr: true,
		},
		{
			name: "unsupported operator",
			filters: []schemas.ColumnFilter{
				{Name: "x", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorGreaterThan, Value: 1},
				}},
			},
			wantErr: true,
		},
		{
			name: "skips table label column filter",
			filters: []schemas.ColumnFilter{
				{Name: "service_name", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorEquals, Value: "other"},
				}},
			},
			want: `{service_name="carts"}`,
		},
		{
			name: "skips timestamp pseudo-column",
			filters: []schemas.ColumnFilter{
				{Name: "timestamp", Conditions: []schemas.FilterCondition{
					{Operator: schemas.OperatorEquals, Value: "ignored"},
				}},
			},
			want: `{service_name="carts"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := buildLogQLExpr(tbl, val, tt.filters)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

// testDatasourceInfoServiceName returns datasource info whose SchemaProvider resolves the SQL table
// label to service_name (matches defaultSchemaTableLabel for assertions).
func testDatasourceInfoServiceName(t *testing.T) *datasourceInfo {
	t.Helper()
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		if strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "" {
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		}
		t.Fatalf("unexpected request: %s %s", req.Method, req.URL.String())
		return 0, "", nil
	})
	return &datasourceInfo{schemaProvider: p}
}

func queryDataRequestWithDSAbstraction(queries []backend.DataQuery) *backend.QueryDataRequest {
	return &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
		},
		Queries: queries,
	}
}

func TestNormalizeGrafanaSQLRequest_passthroughPaths(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	tr := backend.TimeRange{From: time.Now().Add(-time.Hour), To: time.Now()}

	t.Run("invalid json keeps query unchanged", func(t *testing.T) {
		orig := backend.DataQuery{RefID: "A", JSON: []byte(`{`), TimeRange: tr}
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{orig})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, refIDs)
		require.Empty(t, sqlErrs)
		require.Equal(t, `{`, string(out.Queries[0].JSON))
	})

	t.Run("grafanaSql false", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{"refId": "A", "grafanaSql": false, "table": "carts", "expr": "{}"})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, refIDs)
		require.Empty(t, sqlErrs)
		require.JSONEq(t, string(raw), string(out.Queries[0].JSON))
	})

	t.Run("empty table returns sql error", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{"refId": "A", "grafanaSql": true, "table": ""})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, refIDs)
		require.Empty(t, out.Queries)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "table name is required")
	})

	t.Run("nil schema provider returns sql error", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{"refId": "A", "grafanaSql": true, "table": "carts"})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, &datasourceInfo{})
		require.Empty(t, refIDs)
		require.Empty(t, out.Queries)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "no schema provider")
	})

	t.Run("buildLogQL failure omits query and returns sql error", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{
			"refId":      "A",
			"grafanaSql": true,
			"table":      "carts",
			"filters": []map[string]any{{
				"name": "bad",
				"conditions": []map[string]any{{
					"operator": string(schemas.OperatorGreaterThan),
					"value":    1,
				}},
			}},
		})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, refIDs)
		require.Empty(t, out.Queries)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "failed to build LogQL")
		require.ErrorContains(t, sqlErrs["A"], "unsupported filter operator")
	})

	t.Run("mixed invalid and valid grafana sql", func(t *testing.T) {
		badRaw, err := json.Marshal(map[string]any{
			"refId":      "A",
			"grafanaSql": true,
			"table":      "carts",
			"filters": []map[string]any{{
				"name": "bad",
				"conditions": []map[string]any{{
					"operator": string(schemas.OperatorGreaterThan),
					"value":    1,
				}},
			}},
		})
		require.NoError(t, err)
		goodRaw, err := json.Marshal(map[string]any{"refId": "B", "grafanaSql": true, "table": "carts"})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{
			{RefID: "A", JSON: badRaw, TimeRange: tr},
			{RefID: "B", JSON: goodRaw, TimeRange: tr},
		})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "failed to build LogQL")
		require.Len(t, out.Queries, 1)
		require.Equal(t, "B", out.Queries[0].RefID)
		require.Contains(t, refIDs, "B")
	})
}

func TestNormalizeGrafanaSQLRequest_hints(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	from := time.Date(2024, 3, 1, 10, 0, 0, 0, time.UTC)
	to := from.Add(time.Hour)
	tr := backend.TimeRange{From: from, To: to}

	base := map[string]any{
		"refId": "A", "grafanaSql": true, "table": "carts",
	}

	t.Run("step sets model step and interval", func(t *testing.T) {
		payload := cloneMap(base)
		payload["tableHintValues"] = map[string]string{"STEP": "30s"}
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		q := backend.DataQuery{RefID: "A", JSON: raw, TimeRange: tr, Interval: time.Minute}
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{q}), ds)
		require.Contains(t, refIDs, "A")
		require.Empty(t, sqlErrs)
		var model QueryJSONModel
		require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
		require.NotNil(t, model.Step)
		require.Equal(t, "30s", *model.Step)
		require.Equal(t, 30*time.Second, out.Queries[0].Interval)
		require.Equal(t, int64(120), out.Queries[0].MaxDataPoints)
	})

	t.Run("invalid step returns sql error", func(t *testing.T) {
		payload := cloneMap(base)
		payload["tableHintValues"] = map[string]string{"STEP": "not-a-duration"}
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, refIDs)
		require.Empty(t, out.Queries)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "failed to parse STEP hint")
		require.ErrorContains(t, sqlErrs["A"], "not-a-duration")
	})

	t.Run("schemas Query limit field sets max lines", func(t *testing.T) {
		payload := cloneMap(base)
		payload["limit"] = int64(500)
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Contains(t, refIDs, "A")
		require.Empty(t, sqlErrs)
		var model QueryJSONModel
		require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
		require.NotNil(t, model.MaxLines)
		require.Equal(t, int64(500), *model.MaxLines)
	})

	t.Run("direction forward", func(t *testing.T) {
		payload := cloneMap(base)
		payload["tableHintValues"] = map[string]string{"DIRECTION": "forward"}
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Contains(t, refIDs, "A")
		require.Empty(t, sqlErrs)
		var model QueryJSONModel
		require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
		require.NotNil(t, model.Direction)
		require.Equal(t, "forward", *model.Direction)
	})

	t.Run("lowercase hint keys via EqualFold", func(t *testing.T) {
		payload := cloneMap(base)
		payload["tableHintValues"] = map[string]string{"step": "1m"}
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Contains(t, refIDs, "A")
		require.Empty(t, sqlErrs)
		var model QueryJSONModel
		require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
		require.NotNil(t, model.Step)
		require.Equal(t, "1m", *model.Step)
	})
}

func cloneMap(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func TestNormalizeGrafanaSQLRequest_Disabled(t *testing.T) {
	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "",
			}),
		},
		Queries: []backend.DataQuery{{
			RefID: "A",
			JSON:  []byte(`{"grafanaSql":true,"table":"carts","refId":"A"}`),
		}},
	}
	ds := &datasourceInfo{}
	out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
	require.Same(t, req, out)
	require.Nil(t, refIDs)
	require.Empty(t, sqlErrs)
}

func TestNormalizeGrafanaSQLRequest_Converts(t *testing.T) {
	sq, err := json.Marshal(map[string]any{
		"refId":      "A",
		"grafanaSql": true,
		"table":      "carts",
	})
	require.NoError(t, err)

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{
				featuretoggles.EnabledFeatures: "dsAbstractionApp",
			}),
		},
		Queries: []backend.DataQuery{{
			RefID:     "A",
			JSON:      sq,
			Interval:  10 * time.Second,
			TimeRange: backend.TimeRange{From: time.Now().Add(-time.Hour), To: time.Now()},
		}},
	}
	ds := testDatasourceInfoServiceName(t)

	out, refIDs, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
	require.Len(t, out.Queries, 1)
	require.Contains(t, refIDs, "A")
	require.Empty(t, sqlErrs)

	var model QueryJSONModel
	require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
	require.Equal(t, `{service_name="carts"}`, model.Expr)
	require.NotNil(t, model.QueryType)
	require.Equal(t, "range", *model.QueryType)
}

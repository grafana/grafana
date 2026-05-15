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
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, sqlKinds)
		require.Empty(t, sqlErrs)
		require.Equal(t, `{`, string(out.Queries[0].JSON))
	})

	t.Run("grafanaSql false", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{"refId": "A", "grafanaSql": false, "table": "carts", "expr": "{}"})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, sqlKinds)
		require.Empty(t, sqlErrs)
		require.JSONEq(t, string(raw), string(out.Queries[0].JSON))
	})

	t.Run("empty table returns sql error", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{"refId": "A", "grafanaSql": true, "table": ""})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, sqlKinds)
		require.Empty(t, out.Queries)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "table name is required")
	})

	t.Run("nil schema provider returns sql error", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{"refId": "A", "grafanaSql": true, "table": "carts"})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, &datasourceInfo{})
		require.Empty(t, sqlKinds)
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
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, sqlKinds)
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
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "failed to build LogQL")
		require.Len(t, out.Queries, 1)
		require.Equal(t, "B", out.Queries[0].RefID)
		require.Equal(t, sqlKindLog, sqlKinds["B"])
		require.NotContains(t, sqlKinds, "A")
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
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{q}), ds)
		require.Equal(t, sqlKindLog, sqlKinds["A"])
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
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, sqlKinds)
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
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Equal(t, sqlKindLog, sqlKinds["A"])
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
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Equal(t, sqlKindLog, sqlKinds["A"])
		require.Empty(t, sqlErrs)
		var model QueryJSONModel
		require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
		require.NotNil(t, model.Direction)
		require.Equal(t, "forward", *model.Direction)
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
	out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
	require.Same(t, req, out)
	require.Nil(t, sqlKinds)
	require.Empty(t, sqlErrs)
}

func TestBuildGrafanaSQLMetricExpr(t *testing.T) {
	t.Parallel()
	const sel = `{service_name="carts"}`
	win := time.Minute

	t.Run("count with group by", func(t *testing.T) {
		t.Parallel()
		expr, err := buildGrafanaSQLMetricExpr(sel, &aggregationHint{
			Function: "COUNT",
			Column:   "line",
			GroupBy:  []string{"env", "timestamp"},
		}, win, 0)
		require.NoError(t, err)
		require.Equal(t, `sum by (env) (count_over_time({service_name="carts"}[1m]))`, expr)
	})

	t.Run("sum bytes", func(t *testing.T) {
		t.Parallel()
		expr, err := buildGrafanaSQLMetricExpr(sel, &aggregationHint{
			Function: "SUM",
			Column:   "bytes",
			GroupBy:  []string{"pod"},
		}, win, 0)
		require.NoError(t, err)
		require.Equal(t, `sum by (pod) (bytes_over_time({service_name="carts"}[1m]))`, expr)
	})

	t.Run("rate hint wraps aggregation", func(t *testing.T) {
		t.Parallel()
		expr, err := buildGrafanaSQLMetricExpr(sel, &aggregationHint{
			Function: "SUM",
			Column:   "line",
			GroupBy:  []string{"env"},
		}, win, 5*time.Minute)
		require.NoError(t, err)
		require.Equal(t, `sum by (env) (rate({service_name="carts"}[5m]))`, expr)
	})

	t.Run("rate hint bytes column uses bytes_rate", func(t *testing.T) {
		t.Parallel()
		expr, err := buildGrafanaSQLMetricExpr(sel, &aggregationHint{
			Function: "SUM",
			Column:   "bytes",
			GroupBy:  []string{},
		}, win, time.Minute)
		require.NoError(t, err)
		require.Equal(t, `sum(bytes_rate({service_name="carts"}[1m]))`, expr)
	})

	t.Run("rate only without aggregation", func(t *testing.T) {
		t.Parallel()
		expr, err := buildGrafanaSQLMetricExpr(sel, nil, win, 30*time.Second)
		require.NoError(t, err)
		require.Equal(t, `rate({service_name="carts"}[30s])`, expr)
	})

	t.Run("unsupported function", func(t *testing.T) {
		t.Parallel()
		_, err := buildGrafanaSQLMetricExpr(sel, &aggregationHint{Function: "STDDEV"}, win, 0)
		require.ErrorContains(t, err, "unsupported aggregation function")
	})

	t.Run("unsupported column", func(t *testing.T) {
		t.Parallel()
		_, err := buildGrafanaSQLMetricExpr(sel, &aggregationHint{Function: "SUM", Column: "unknown_metric"}, win, 0)
		require.ErrorContains(t, err, "unsupported aggregation column")
	})
}

func TestNormalizeGrafanaSQLRequest_metricAggregation(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	from := time.Date(2024, 3, 1, 10, 0, 0, 0, time.UTC)
	to := from.Add(time.Hour)
	tr := backend.TimeRange{From: from, To: to}

	raw, err := json.Marshal(map[string]any{
		"refId":       "A",
		"grafanaSql":  true,
		"table":       "carts",
		"aggregation": map[string]any{"function": "COUNT", "column": "line", "groupBy": []string{"env"}},
	})
	require.NoError(t, err)
	req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})

	out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
	require.Empty(t, sqlErrs)
	require.Equal(t, sqlKindMetric, sqlKinds["A"])

	var model QueryJSONModel
	require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
	require.Equal(t, `sum by (env) (count_over_time({service_name="carts"}[1m]))`, model.Expr)
	require.Nil(t, model.Direction)
	require.Nil(t, model.MaxLines)
	require.NotNil(t, model.Step)
	require.Equal(t, "1m", *model.Step)
}

func TestNormalizeGrafanaSQLRequest_rateAndInstant(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	from := time.Date(2024, 3, 1, 10, 0, 0, 0, time.UTC)
	to := from.Add(time.Hour)
	tr := backend.TimeRange{From: from, To: to}

	t.Run("RATE only sets metric expr and ref ID", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"RATE": "2m"},
		})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, sqlErrs)
		require.Equal(t, sqlKindMetric, sqlKinds["A"])
		var model QueryJSONModel
		require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
		require.Equal(t, `rate({service_name="carts"}[2m])`, model.Expr)
		require.Equal(t, "range", *model.QueryType)
		require.NotNil(t, model.Step)
		require.Equal(t, "2m", *model.Step)
	})

	t.Run("INSTANT sets query type on metric query", func(t *testing.T) {
		// Key presence only (empty value), matching grafana-prometheus-datasource promlib.
		raw, err := json.Marshal(map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"RATE": "1m", "INSTANT": ""},
		})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, _, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, sqlErrs)
		var model QueryJSONModel
		require.NoError(t, json.Unmarshal(out.Queries[0].JSON, &model))
		require.Equal(t, "instant", *model.QueryType)
		require.Nil(t, model.Step)
	})

	t.Run("INSTANT on log query errors", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"INSTANT": ""},
		})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, _, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, out.Queries)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "INSTANT hint requires a metric query")
	})

	t.Run("invalid RATE duration errors", func(t *testing.T) {
		raw, err := json.Marshal(map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"RATE": "not-a-duration"},
		})
		require.NoError(t, err)
		req := queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}})
		out, _, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, ds)
		require.Empty(t, out.Queries)
		require.ErrorContains(t, sqlErrs["A"], "failed to parse RATE hint")
	})
}

func TestParseSQLHints(t *testing.T) {
	t.Parallel()

	t.Run("nil hints", func(t *testing.T) {
		t.Parallel()
		h, err := parseSQLHints(nil)
		require.NoError(t, err)
		require.Equal(t, sqlHints{}, h)
	})

	t.Run("STEP and RATE populate raw and parsed values", func(t *testing.T) {
		t.Parallel()
		h, err := parseSQLHints(map[string]string{"STEP": "30s", "RATE": "5m"})
		require.NoError(t, err)
		require.Equal(t, "30s", h.stepStr)
		require.Equal(t, 30*time.Second, h.stepDur)
		require.Equal(t, "5m", h.rateStr)
		require.Equal(t, 5*time.Minute, h.rateDur)
	})

	t.Run("DIRECTION is lowercased", func(t *testing.T) {
		t.Parallel()
		h, err := parseSQLHints(map[string]string{"DIRECTION": "FORWARD"})
		require.NoError(t, err)
		require.Equal(t, "forward", h.direction)
	})

	t.Run("INSTANT presence sets flag regardless of value", func(t *testing.T) {
		t.Parallel()
		h, err := parseSQLHints(map[string]string{"INSTANT": ""})
		require.NoError(t, err)
		require.True(t, h.instant)
	})

	t.Run("lowercase hint keys are recognised", func(t *testing.T) {
		t.Parallel()
		h, err := parseSQLHints(map[string]string{"step": "1m", "instant": ""})
		require.NoError(t, err)
		require.Equal(t, "1m", h.stepStr)
		require.True(t, h.instant)
	})

	t.Run("invalid STEP returns wrapped error", func(t *testing.T) {
		t.Parallel()
		_, err := parseSQLHints(map[string]string{"STEP": "not-a-duration"})
		require.ErrorContains(t, err, "loki grafana sql:")
		require.ErrorContains(t, err, "failed to parse STEP hint")
		require.ErrorContains(t, err, "not-a-duration")
	})

	t.Run("invalid RATE returns wrapped error", func(t *testing.T) {
		t.Parallel()
		_, err := parseSQLHints(map[string]string{"RATE": "bogus"})
		require.ErrorContains(t, err, "loki grafana sql:")
		require.ErrorContains(t, err, "failed to parse RATE hint")
	})
}

func TestBuildLogPlan(t *testing.T) {
	t.Parallel()
	const sel = `{service_name="carts"}`

	t.Run("default plan is range with selector and no overrides", func(t *testing.T) {
		t.Parallel()
		plan := buildLogPlan(sel, grafanaSQLQuery{}, sqlHints{})
		require.Equal(t, sel, plan.expr)
		require.Equal(t, "range", plan.queryType)
		require.Equal(t, sqlKindLog, plan.kind)
		require.Equal(t, "", plan.modelStep)
		require.Equal(t, time.Duration(0), plan.intervalStep)
		require.Equal(t, int64(0), plan.maxLines)
		require.Nil(t, plan.direction)
	})

	t.Run("STEP populates both intervalStep and modelStep", func(t *testing.T) {
		t.Parallel()
		plan := buildLogPlan(sel, grafanaSQLQuery{}, sqlHints{stepStr: "30s", stepDur: 30 * time.Second})
		require.Equal(t, "30s", plan.modelStep)
		require.Equal(t, 30*time.Second, plan.intervalStep)
	})

	t.Run("direction forward and backward are passed through", func(t *testing.T) {
		t.Parallel()
		for _, dir := range []string{"forward", "backward"} {
			plan := buildLogPlan(sel, grafanaSQLQuery{}, sqlHints{direction: dir})
			require.NotNil(t, plan.direction, "direction %q", dir)
			require.Equal(t, dir, *plan.direction)
		}
	})

	t.Run("unknown direction is nil", func(t *testing.T) {
		t.Parallel()
		plan := buildLogPlan(sel, grafanaSQLQuery{}, sqlHints{direction: "sideways"})
		require.Nil(t, plan.direction)
	})

	t.Run("positive limit becomes maxLines", func(t *testing.T) {
		t.Parallel()
		lim := int64(500)
		sq := grafanaSQLQuery{Query: schemas.Query{Limit: &lim}}
		plan := buildLogPlan(sel, sq, sqlHints{})
		require.Equal(t, int64(500), plan.maxLines)
	})

	t.Run("non-positive limit is ignored", func(t *testing.T) {
		t.Parallel()
		lim := int64(0)
		sq := grafanaSQLQuery{Query: schemas.Query{Limit: &lim}}
		plan := buildLogPlan(sel, sq, sqlHints{})
		require.Equal(t, int64(0), plan.maxLines)
	})
}

func TestBuildMetricPlan(t *testing.T) {
	t.Parallel()
	const sel = `{service_name="carts"}`
	queryDur := time.Hour
	countLine := &aggregationHint{Function: "COUNT", Column: "line", GroupBy: []string{"env"}}

	t.Run("aggregation only defaults step to window", func(t *testing.T) {
		t.Parallel()
		plan, err := buildMetricPlan(sel, grafanaSQLQuery{Aggregation: countLine}, sqlHints{}, queryDur)
		require.NoError(t, err)
		require.Equal(t, `sum by (env) (count_over_time({service_name="carts"}[1m]))`, plan.expr)
		require.Equal(t, "range", plan.queryType)
		require.Equal(t, "1m", plan.modelStep)
		require.Equal(t, time.Minute, plan.intervalStep)
		require.Equal(t, sqlKindMetric, plan.kind)
		require.Nil(t, plan.direction)
	})

	t.Run("aggregation with STEP uses step as window", func(t *testing.T) {
		t.Parallel()
		h := sqlHints{stepStr: "30s", stepDur: 30 * time.Second}
		plan, err := buildMetricPlan(sel, grafanaSQLQuery{Aggregation: countLine}, h, queryDur)
		require.NoError(t, err)
		require.Equal(t, `sum by (env) (count_over_time({service_name="carts"}[30s]))`, plan.expr)
		require.Equal(t, "30s", plan.modelStep)
		require.Equal(t, 30*time.Second, plan.intervalStep)
	})

	t.Run("RATE without aggregation produces rate expr and defaults step to rate", func(t *testing.T) {
		t.Parallel()
		h := sqlHints{rateStr: "2m", rateDur: 2 * time.Minute}
		plan, err := buildMetricPlan(sel, grafanaSQLQuery{}, h, queryDur)
		require.NoError(t, err)
		require.Equal(t, `rate({service_name="carts"}[2m])`, plan.expr)
		require.Equal(t, "2m", plan.modelStep)
		require.Equal(t, 2*time.Minute, plan.intervalStep)
	})

	t.Run("aggregation with RATE wraps rate expression", func(t *testing.T) {
		t.Parallel()
		h := sqlHints{rateStr: "5m", rateDur: 5 * time.Minute}
		plan, err := buildMetricPlan(sel, grafanaSQLQuery{Aggregation: countLine}, h, queryDur)
		require.NoError(t, err)
		require.Equal(t, `sum by (env) (rate({service_name="carts"}[5m]))`, plan.expr)
		require.Equal(t, "5m", plan.modelStep)
		require.Equal(t, 5*time.Minute, plan.intervalStep)
	})

	// Key invariant the refactor preserves: instant queries clear modelStep (Loki's instant API
	// has no step) but intervalStep keeps the underlying duration so q.Interval is still updated.
	t.Run("instant with STEP clears modelStep but keeps intervalStep", func(t *testing.T) {
		t.Parallel()
		h := sqlHints{stepStr: "30s", stepDur: 30 * time.Second, instant: true}
		plan, err := buildMetricPlan(sel, grafanaSQLQuery{Aggregation: countLine}, h, queryDur)
		require.NoError(t, err)
		require.Equal(t, "instant", plan.queryType)
		require.Equal(t, "", plan.modelStep)
		require.Equal(t, 30*time.Second, plan.intervalStep)
	})

	t.Run("instant without STEP yields zero intervalStep", func(t *testing.T) {
		t.Parallel()
		h := sqlHints{rateStr: "1m", rateDur: time.Minute, instant: true}
		plan, err := buildMetricPlan(sel, grafanaSQLQuery{}, h, queryDur)
		require.NoError(t, err)
		require.Equal(t, "instant", plan.queryType)
		require.Equal(t, "", plan.modelStep)
		require.Equal(t, time.Duration(0), plan.intervalStep)
	})

	t.Run("unsupported aggregation function returns wrapped error", func(t *testing.T) {
		t.Parallel()
		sq := grafanaSQLQuery{Aggregation: &aggregationHint{Function: "STDDEV"}}
		_, err := buildMetricPlan(sel, sq, sqlHints{}, queryDur)
		require.ErrorContains(t, err, "loki grafana sql:")
		require.ErrorContains(t, err, "unsupported aggregation function")
	})
}

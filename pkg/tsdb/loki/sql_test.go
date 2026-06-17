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
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && strings.Contains(req.URL.Query().Get("query"), `service_name="carts"`):
			return 200, "", []byte(`{"status":"success","data":["env","service_name"]}`)
		default:
			t.Fatalf("unexpected request: %s %s", req.Method, req.URL.String())
		}
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

func normalizeGrafanaSQLTimeRange() backend.TimeRange {
	from := time.Date(2024, 3, 1, 10, 0, 0, 0, time.UTC)
	return backend.TimeRange{From: from, To: from.Add(time.Hour)}
}

func grafanaSQLBasePayload() map[string]any {
	return map[string]any{"refId": "A", "grafanaSql": true, "table": "carts"}
}

func marshalGrafanaSQLPayload(t *testing.T, payload map[string]any) []byte {
	t.Helper()
	raw, err := json.Marshal(payload)
	require.NoError(t, err)
	return raw
}

type normalizedQueryExpect struct {
	expr          string
	queryType     string
	checkStep     bool
	step          *string // when checkStep: nil = require nil step, non-nil = require value
	direction     *string
	maxLines      *int64
	interval      time.Duration
	maxDataPoints int64
}

func assertNormalizedQuery(t *testing.T, q backend.DataQuery, exp normalizedQueryExpect) {
	t.Helper()
	var model QueryJSONModel
	require.NoError(t, json.Unmarshal(q.JSON, &model))
	require.Equal(t, exp.expr, model.Expr)
	if exp.queryType != "" {
		require.NotNil(t, model.QueryType)
		require.Equal(t, exp.queryType, *model.QueryType)
	}
	if exp.checkStep {
		if exp.step == nil {
			require.Nil(t, model.Step)
		} else {
			require.NotNil(t, model.Step)
			require.Equal(t, *exp.step, *model.Step)
		}
	}
	if exp.direction != nil {
		require.NotNil(t, model.Direction)
		require.Equal(t, *exp.direction, *model.Direction)
	}
	if exp.maxLines != nil {
		require.NotNil(t, model.MaxLines)
		require.Equal(t, *exp.maxLines, *model.MaxLines)
	}
	if exp.interval > 0 {
		require.Equal(t, exp.interval, q.Interval)
	}
	if exp.maxDataPoints > 0 {
		require.Equal(t, exp.maxDataPoints, q.MaxDataPoints)
	}
}

func TestNormalizeGrafanaSQLRequest_passthrough(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	tr := normalizeGrafanaSQLTimeRange()

	t.Run("invalid json keeps query unchanged", func(t *testing.T) {
		orig := backend.DataQuery{RefID: "A", JSON: []byte(`{`), TimeRange: tr}
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{orig}), ds)
		require.Empty(t, sqlKinds)
		require.Empty(t, sqlErrs)
		require.Equal(t, `{`, string(out.Queries[0].JSON))
	})

	t.Run("grafanaSql false", func(t *testing.T) {
		raw := marshalGrafanaSQLPayload(t, map[string]any{"refId": "A", "grafanaSql": false, "table": "carts", "expr": "{}"})
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}}), ds)
		require.Empty(t, sqlKinds)
		require.Empty(t, sqlErrs)
		require.JSONEq(t, string(raw), string(out.Queries[0].JSON))
	})

	t.Run("feature toggle disabled", func(t *testing.T) {
		req := &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				GrafanaConfig: config.NewGrafanaCfg(map[string]string{
					featuretoggles.EnabledFeatures: "",
				}),
			},
			Queries: []backend.DataQuery{{
				RefID: "A",
				JSON:  marshalGrafanaSQLPayload(t, grafanaSQLBasePayload()),
			}},
		}
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), req, &datasourceInfo{})
		require.Same(t, req, out)
		require.Nil(t, sqlKinds)
		require.Empty(t, sqlErrs)
	})
}

func TestNormalizeGrafanaSQLRequest(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	tr := normalizeGrafanaSQLTimeRange()
	base := grafanaSQLBasePayload()
	const logSelector = `{service_name="carts"}`

	successCases := []struct {
		name     string
		payload  map[string]any
		interval time.Duration
		kind     sqlKind
		expect   normalizedQueryExpect
	}{
		{
			name:    "log stream default",
			payload: base,
			expect: normalizedQueryExpect{
				expr:      logSelector,
				queryType: lokiQueryTypeRange,
			},
			kind: sqlKindLog,
		},
		{
			name: "log stream with STEP",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["tableHintValues"] = map[string]string{"STEP": "30s"}
				return p
			}(),
			interval: time.Minute,
			expect: normalizedQueryExpect{
				expr:          logSelector,
				queryType:     lokiQueryTypeRange,
				checkStep:     true,
				step:          strPtr("30s"),
				interval:      30 * time.Second,
				maxDataPoints: 120,
			},
			kind: sqlKindLog,
		},
		{
			name: "log stream with limit",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["limit"] = int64(500)
				return p
			}(),
			expect: normalizedQueryExpect{
				expr:      logSelector,
				queryType: lokiQueryTypeRange,
				maxLines:  int64Ptr(500),
			},
			kind: sqlKindLog,
		},
		{
			name: "log stream with direction",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["tableHintValues"] = map[string]string{"DIRECTION": "forward"}
				return p
			}(),
			expect: normalizedQueryExpect{
				expr:      logSelector,
				queryType: lokiQueryTypeRange,
				direction: strPtr("forward"),
			},
			kind: sqlKindLog,
		},
		{
			name: "metric aggregation",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["aggregation"] = map[string]any{"function": "COUNT", "column": "line", "groupBy": []string{"env"}}
				return p
			}(),
			expect: normalizedQueryExpect{
				expr:      `sum by (env) (count_over_time({service_name="carts"}[1m]))`,
				queryType: lokiQueryTypeRange,
				checkStep: true,
				step:      strPtr("1m"),
			},
			kind: sqlKindMetric,
		},
		{
			name: "metric RATE only",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["tableHintValues"] = map[string]string{"RATE": "2m"}
				return p
			}(),
			expect: normalizedQueryExpect{
				expr:      `rate({service_name="carts"}[2m])`,
				queryType: lokiQueryTypeRange,
				checkStep: true,
				step:      strPtr("2m"),
			},
			kind: sqlKindMetric,
		},
		{
			name: "metric RATE with INSTANT",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["tableHintValues"] = map[string]string{"RATE": "1m", "INSTANT": ""}
				return p
			}(),
			expect: normalizedQueryExpect{
				expr:      `rate({service_name="carts"}[1m])`,
				queryType: lokiQueryTypeInstant,
				checkStep: true,
			},
			kind: sqlKindMetric,
		},
	}

	for _, tc := range successCases {
		t.Run(tc.name, func(t *testing.T) {
			raw := marshalGrafanaSQLPayload(t, tc.payload)
			q := backend.DataQuery{RefID: "A", JSON: raw, TimeRange: tr, Interval: tc.interval}
			out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{q}), ds)
			require.Empty(t, sqlErrs)
			require.Equal(t, tc.kind, sqlKinds["A"])
			assertNormalizedQuery(t, out.Queries[0], tc.expect)
		})
	}

	errorCases := []struct {
		name        string
		payload     map[string]any
		ds          *datasourceInfo
		refID       string
		errContains []string
	}{
		{
			name:        "empty table",
			payload:     func() map[string]any { p := mapsClone(base); p["table"] = ""; return p }(),
			errContains: []string{"table name is required"},
		},
		{
			name:        "nil schema provider",
			payload:     base,
			ds:          &datasourceInfo{},
			errContains: []string{"no schema provider"},
		},
		{
			name: "unsupported filter operator",
			payload: map[string]any{
				"refId": "A", "grafanaSql": true, "table": "carts",
				"filters": []map[string]any{{
					"name": "bad",
					"conditions": []map[string]any{{
						"operator": string(schemas.OperatorGreaterThan),
						"value":    1,
					}},
				}},
			},
			errContains: []string{"failed to build LogQL", "unsupported filter operator"},
		},
		{
			name: "invalid STEP",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["tableHintValues"] = map[string]string{"STEP": "not-a-duration"}
				return p
			}(),
			errContains: []string{"failed to parse STEP hint", "not-a-duration"},
		},
		{
			name: "INSTANT on log query",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["tableHintValues"] = map[string]string{"INSTANT": ""}
				return p
			}(),
			errContains: []string{"INSTANT hint requires a metric query"},
		},
		{
			name: "invalid RATE",
			payload: func() map[string]any {
				p := mapsClone(base)
				p["tableHintValues"] = map[string]string{"RATE": "not-a-duration"}
				return p
			}(),
			errContains: []string{"failed to parse RATE hint"},
		},
	}

	for _, tc := range errorCases {
		t.Run(tc.name, func(t *testing.T) {
			dsInfo := tc.ds
			if dsInfo == nil {
				dsInfo = ds
			}
			refID := tc.refID
			if refID == "" {
				refID = "A"
			}
			raw := marshalGrafanaSQLPayload(t, tc.payload)
			out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: refID, JSON: raw, TimeRange: tr}}), dsInfo)
			require.Empty(t, sqlKinds)
			require.Empty(t, out.Queries)
			require.Len(t, sqlErrs, 1)
			for _, sub := range tc.errContains {
				require.ErrorContains(t, sqlErrs[refID], sub)
			}
		})
	}

	t.Run("mixed invalid and valid grafana sql", func(t *testing.T) {
		badRaw := marshalGrafanaSQLPayload(t, map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"filters": []map[string]any{{
				"name": "bad",
				"conditions": []map[string]any{{
					"operator": string(schemas.OperatorGreaterThan),
					"value":    1,
				}},
			}},
		})
		goodRaw := marshalGrafanaSQLPayload(t, mapsCloneWithRefID("B", base))
		out, sqlKinds, sqlErrs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{
			{RefID: "A", JSON: badRaw, TimeRange: tr},
			{RefID: "B", JSON: goodRaw, TimeRange: tr},
		}), ds)
		require.Len(t, sqlErrs, 1)
		require.ErrorContains(t, sqlErrs["A"], "failed to build LogQL")
		require.Len(t, out.Queries, 1)
		require.Equal(t, "B", out.Queries[0].RefID)
		require.Equal(t, sqlKindLog, sqlKinds["B"])
		assertNormalizedQuery(t, out.Queries[0], normalizedQueryExpect{
			expr:      logSelector,
			queryType: lokiQueryTypeRange,
		})
	})
}

func TestNormalizeGrafanaSQLRequest_parser(t *testing.T) {
	ds := testDatasourceInfoServiceName(t)
	tr := normalizeGrafanaSQLTimeRange()

	t.Run("json parser with mixed filters", func(t *testing.T) {
		raw := marshalGrafanaSQLPayload(t, map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"PARSER": "json"},
			"filters": []map[string]any{
				{"name": "env", "conditions": []map[string]any{{"operator": string(schemas.OperatorEquals), "value": "prod"}}},
				{"name": "level", "conditions": []map[string]any{{"operator": string(schemas.OperatorEquals), "value": "error"}}},
			},
		})
		out, kinds, errs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}}), ds)
		require.Empty(t, errs)
		require.Equal(t, sqlKindLog, kinds["A"])
		assertNormalizedQuery(t, out.Queries[0], normalizedQueryExpect{
			expr:      `{env="prod", service_name="carts"} | json | level = "error"`,
			queryType: lokiQueryTypeRange,
		})
	})

	t.Run("json unpack chain", func(t *testing.T) {
		raw := marshalGrafanaSQLPayload(t, map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{"PARSER": "json | unpack"},
		})
		out, _, errs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}}), ds)
		require.Empty(t, errs)
		assertNormalizedQuery(t, out.Queries[0], normalizedQueryExpect{
			expr:      `{service_name="carts"} | json | unpack`,
			queryType: lokiQueryTypeRange,
		})
	})

	t.Run("pattern parser with mixed filters", func(t *testing.T) {
		raw := marshalGrafanaSQLPayload(t, map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"tableHintValues": map[string]string{
				"PARSER": `pattern "<_> - - <_> \"<method> <path> <_>\" <status> <_>"`,
			},
			"filters": []map[string]any{
				{"name": "env", "conditions": []map[string]any{{"operator": string(schemas.OperatorEquals), "value": "prod"}}},
				{"name": "status", "conditions": []map[string]any{{"operator": string(schemas.OperatorEquals), "value": "500"}}},
			},
		})
		out, _, errs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}}), ds)
		require.Empty(t, errs)
		assertNormalizedQuery(t, out.Queries[0], normalizedQueryExpect{
			expr:      `{env="prod", service_name="carts"} | pattern "<_> - - <_> \"<method> <path> <_>\" <status> <_>" | status = "500"`,
			queryType: lokiQueryTypeRange,
		})
	})

	t.Run("parsed filter without parser hint", func(t *testing.T) {
		raw := marshalGrafanaSQLPayload(t, map[string]any{
			"refId": "A", "grafanaSql": true, "table": "carts",
			"filters": []map[string]any{
				{"name": "level", "conditions": []map[string]any{{"operator": string(schemas.OperatorEquals), "value": "error"}}},
			},
		})
		_, _, errs := normalizeGrafanaSQLRequest(context.Background(), queryDataRequestWithDSAbstraction([]backend.DataQuery{{RefID: "A", JSON: raw, TimeRange: tr}}), ds)
		require.ErrorContains(t, errs["A"], `column "level" requires a parser FOR hint`)
	})
}

func mapsClone(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func mapsCloneWithRefID(refID string, m map[string]any) map[string]any {
	out := mapsClone(m)
	out["refId"] = refID
	return out
}

func strPtr(s string) *string { return &s }

func int64Ptr(n int64) *int64 { return &n }

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

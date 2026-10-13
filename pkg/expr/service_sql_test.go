package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestSQLService(t *testing.T) {
	inputFrame := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", nil, []*float64{new(2.0)}),
	)

	resp := map[string]backend.DataResponse{
		"A": {Frames: data.Frames{inputFrame}},
	}

	newABSQLQueries := func(q string) []Query {
		escaped, err := json.Marshal(q)
		require.NoError(t, err)
		return []Query{
			{
				RefID: "A",
				DataSource: &datasources.DataSource{
					OrgID: 1,
					UID:   "test",
					Type:  "test",
				},
				JSON: json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
				TimeRange: AbsoluteTimeRange{
					From: time.Time{},
					To:   time.Time{},
				},
			},
			{
				RefID:      "B",
				DataSource: dataSourceModel(),
				JSON:       json.RawMessage(fmt.Sprintf(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": %s }`, escaped)),
				TimeRange: AbsoluteTimeRange{
					From: time.Time{},
					To:   time.Time{},
				},
			},
		}
	}
	t.Run("no feature flag no queries for you", func(t *testing.T) {
		s, req := newMockQueryService(resp, newABSQLQueries(""))

		_, err := s.BuildPipeline(t.Context(), req)
		require.Error(t, err, "should not be able to build pipeline without feature flag")
	})

	t.Run("with feature flag basic select works", func(t *testing.T) {
		s, req := newMockQueryService(resp, newABSQLQueries("SELECT * FROM A"))
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)
		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)

		res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		inputFrame.RefID = "B"
		inputFrame.Name = "B"
		if diff := cmp.Diff(res.Responses["B"].Frames[0], inputFrame, data.FrameTestCompareOptions()...); diff != "" {
			require.FailNowf(t, "Result mismatch (-want +got):%s\n", diff)
		}
	})

	t.Run("load_file is blocked", func(t *testing.T) {
		s, req := newMockQueryService(resp,
			newABSQLQueries(`SELECT CAST(load_file('/etc/topSecretz') AS CHAR(10000) CHARACTER SET utf8)`),
		)

		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)

		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.Error(t, rsp.Responses["B"].Error, "should return invalid sql error")
		require.ErrorContains(t, rsp.Responses["B"].Error, "not in the allowed list of")
		var sqlErr *sql.ErrorWithCategory
		require.ErrorAs(t, rsp.Responses["B"].Error, &sqlErr)
		require.Equal(t, sql.ErrCategoryBlockedNodeOrFunc, sqlErr.Category())
	})

	t.Run("parse error should be returned", func(t *testing.T) {
		s, req := newMockQueryService(resp,
			newABSQLQueries(`SELECT * FROM A LIMIT sloth`),
		)

		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)

		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.Error(t, rsp.Responses["B"].Error, "should return sql error on parsing")
		require.ErrorContains(t, rsp.Responses["B"].Error, "limit expression expected to be numeric")
		var sqlErr *sql.ErrorWithCategory
		require.ErrorAs(t, rsp.Responses["B"].Error, &sqlErr)
		require.Equal(t, sql.ErrCategoryGeneralGMSError, sqlErr.Category())
	})
}

func TestSQLServiceErrors(t *testing.T) {
	tsMulti := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"testLabelKey": "testLabelValue"}, []*float64{new(2.0)}),
	).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})

	tsMultiNoType := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"testLabelKey": "testLabelValue"}, []*float64{new(2.0)}),
	)

	resp := map[string]backend.DataResponse{
		"tsMulti":       {Frames: data.Frames{tsMulti}},
		"tsMultiNoType": {Frames: data.Frames{tsMultiNoType}},
	}

	newABSQLQueries := func(q string) []Query {
		escaped, err := json.Marshal(q)
		require.NoError(t, err)
		return []Query{
			{
				RefID: "tsMulti",
				DataSource: &datasources.DataSource{
					OrgID: 1,
					UID:   "test",
					Type:  "test",
				},
				JSON: json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
				TimeRange: AbsoluteTimeRange{
					From: time.Time{},
					To:   time.Time{},
				},
			},
			{
				RefID: "tsMultiNoType",
				DataSource: &datasources.DataSource{
					OrgID: 1,
					UID:   "test",
					Type:  "test",
				},
				JSON: json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
				TimeRange: AbsoluteTimeRange{
					From: time.Time{},
					To:   time.Time{},
				},
			},
			{
				RefID:      "sqlExpression",
				DataSource: dataSourceModel(),
				JSON:       json.RawMessage(fmt.Sprintf(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": %s }`, escaped)),
				TimeRange: AbsoluteTimeRange{
					From: time.Time{},
					To:   time.Time{},
				},
			},
		}
	}

	t.Run("conversion failure (and therefore dependency error)", func(t *testing.T) {
		reg := prometheus.NewPedanticRegistry()

		s, req := newMockQueryServiceWithMetricsRegistry(resp,
			newABSQLQueries(`SELECT * FROM tsMultiNoType`),
			reg,
		)

		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)

		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.Error(t, rsp.Responses["tsMultiNoType"].Error, "should return conversion error on DS response")
		require.ErrorContains(t, rsp.Responses["tsMultiNoType"].Error, "missing the data type")
		var sqlErr *sql.ErrorWithCategory
		require.ErrorAs(t, rsp.Responses["tsMultiNoType"].Error, &sqlErr)
		require.Equal(t, sql.ErrCategoryInputConversion, sqlErr.Category())

		require.Error(t, rsp.Responses["sqlExpression"].Error, "should return dependency error")
		require.ErrorContains(t, rsp.Responses["sqlExpression"].Error, "dependency")
		require.ErrorAs(t, rsp.Responses["sqlExpression"].Error, &sqlErr)
		require.Equal(t, sql.ErrCategoryDependency, sqlErr.Category())

		require.Equal(t, 0.0, counterVal(t, s.metrics.SqlCommandCount, "ok", "none"))
		require.Equal(t, 1.0, counterVal(t, s.metrics.SqlCommandCount, "error", sql.ErrCategoryInputConversion))
		require.Equal(t, 1.0, counterVal(t, s.metrics.SqlCommandInputCount, "error", "false", "test", "missing"))
	})

	t.Run("pipeline (expressions and DS queries) will fail if the table is not found, before execution of the sql expression", func(t *testing.T) {
		reg := prometheus.NewPedanticRegistry()

		s, req := newMockQueryServiceWithMetricsRegistry(resp,
			newABSQLQueries(`SELECT * FROM nonExisting`), reg,
		)

		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		_, err := s.BuildPipeline(t.Context(), req)
		var sqlErr *sql.ErrorWithCategory
		require.ErrorAs(t, err, &sqlErr)
		require.Equal(t, sql.ErrCategoryTableNotFound, sqlErr.Category())
		require.Error(t, err, "whole pipeline fails when selecting a dependency that does not exist")

		// Metrics
		require.Equal(t, 0.0, counterVal(t, s.metrics.SqlCommandCount, "ok", "none"))
		require.Equal(t, 1.0, counterVal(t, s.metrics.SqlCommandCount, "error", sql.ErrCategoryTableNotFound))
	})

	t.Run("pipeline will fail if query is longer than the configured limit", func(t *testing.T) {
		s, req := newMockQueryService(resp,
			newABSQLQueries(`SELECT This is too long and does not need to be valid SQL`),
		)
		s.cfg.SQLExpressionQueryLengthLimit = 5
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		_, err := s.BuildPipeline(t.Context(), req)
		require.ErrorContains(t, err, "exceeded the configured limit of 5 characters")
		var sqlErr *sql.ErrorWithCategory
		require.ErrorAs(t, err, &sqlErr)
		require.Equal(t, sql.ErrCategoryQueryTooLong, sqlErr.Category())

		require.Equal(t, 1.0, counterVal(t, s.metrics.SqlCommandCount, "error", sql.ErrCategoryQueryTooLong))
	})
}

// newDSAndSQLQueries returns one "test" data source query per refID, plus an
// SQL expression "S" with the given format ("" for panels, "alerting" for alerts).
func newDSAndSQLQueries(t *testing.T, sqlQuery, format string, dsRefIDs ...string) []Query {
	t.Helper()
	escaped, err := json.Marshal(sqlQuery)
	require.NoError(t, err)
	queries := make([]Query, 0, len(dsRefIDs)+1)
	for _, refID := range dsRefIDs {
		queries = append(queries, Query{
			RefID:      refID,
			DataSource: &datasources.DataSource{OrgID: 1, UID: "test", Type: "test"},
			JSON:       json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange:  AbsoluteTimeRange{},
		})
	}
	queries = append(queries, Query{
		RefID:      "S",
		DataSource: dataSourceModel(),
		JSON:       json.RawMessage(fmt.Sprintf(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": %s, "format": %q }`, escaped, format)),
		TimeRange:  AbsoluteTimeRange{},
	})
	return queries
}

func TestSQLServiceZeroRowNumericWide(t *testing.T) {
	// A filter that matches no rows can produce a zero-row frame that is
	// still declared numeric-wide.
	zeroRowWide := func() *data.Frame {
		return data.NewFrame("",
			data.NewField("name", nil, []string{}),
			data.NewField("age", nil, []int64{}),
			data.NewField("salary", nil, []float64{}),
		).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericWide})
	}
	sibling := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", nil, []float64{1}),
	)

	for _, tc := range []struct {
		name   string
		format string
	}{
		{name: "panel", format: ""},
		{name: "alerting", format: "alerting"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp := map[string]backend.DataResponse{
				"A": {Frames: data.Frames{zeroRowWide()}},
				"C": {Frames: data.Frames{sibling}},
			}
			s, req := newMockQueryService(resp, newDSAndSQLQueries(t, "SELECT * FROM A", tc.format, "A", "C"))
			s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

			pl, err := s.BuildPipeline(t.Context(), req)
			require.NoError(t, err)

			rsp, err := s.ExecutePipeline(t.Context(), time.Now(), pl)
			require.NoError(t, err)

			require.NoError(t, rsp.Responses["A"].Error)
			require.NoError(t, rsp.Responses["S"].Error)
			require.Len(t, rsp.Responses["S"].Frames, 1)
			out := rsp.Responses["S"].Frames[0]
			require.Equal(t, 0, out.Rows())
			names := make([]string, 0, len(out.Fields))
			for _, f := range out.Fields {
				names = append(names, f.Name)
			}
			require.Equal(t, []string{SQLMetricFieldName, SQLValueFieldName}, names)

			require.NoError(t, rsp.Responses["C"].Error)
			require.Len(t, rsp.Responses["C"].Frames, 1)
			require.Equal(t, 1, rsp.Responses["C"].Frames[0].Rows())
		})
	}
}

func TestSQLServiceGroupByDatasource(t *testing.T) {
	labeledMulti := func() data.Frames {
		return data.Frames{
			data.NewFrame("",
				data.NewField("time", nil, []time.Time{time.Unix(1, 0), time.Unix(2, 0)}),
				data.NewField("cpu", data.Labels{"host": "a"}, []float64{1, 2}),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
			data.NewFrame("",
				data.NewField("time", nil, []time.Time{time.Unix(1, 0), time.Unix(2, 0)}),
				data.NewField("cpu", data.Labels{"host": "b"}, []float64{3, 4}),
			).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}),
		}
	}
	table := func() data.Frames {
		return data.Frames{data.NewFrame("",
			data.NewField("a", nil, []float64{1, 2}),
			data.NewField("b", nil, []string{"x", "y"}),
		)}
	}
	zeroRowWide := func() data.Frames {
		return data.Frames{data.NewFrame("",
			data.NewField("name", nil, []string{}),
			data.NewField("salary", nil, []float64{}),
		).SetMeta(&data.FrameMeta{Type: data.FrameTypeNumericWide})}
	}

	fieldNames := func(f *data.Frame) []string {
		names := make([]string, 0, len(f.Fields))
		for _, field := range f.Fields {
			names = append(names, field.Name)
		}
		return names
	}

	toggles := []struct {
		name     string
		features featuremgmt.FeatureToggles
	}{
		{name: "toggle off", features: featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)},
		{name: "toggle on", features: featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions, featuremgmt.FlagSseGroupByDatasource)},
	}

	panelCases := []struct {
		name       string
		frames     data.Frames
		sql        string
		dataType   string
		wantFields []string
		wantRows   int
	}{
		{
			name:       "labeled multi-frame input keeps all series and labels",
			frames:     labeledMulti(),
			sql:        "SELECT * FROM A ORDER BY host, time",
			dataType:   string(data.FrameTypeTimeSeriesMulti),
			wantFields: []string{"time", SQLValueFieldName, SQLMetricFieldName, "host"},
			wantRows:   4,
		},
		{
			name:       "table input keeps all columns and rows",
			frames:     table(),
			sql:        "SELECT * FROM A",
			dataType:   "missing",
			wantFields: []string{"a", "b"},
			wantRows:   2,
		},
		{
			name:       "zero-row numeric-wide input returns zero rows",
			frames:     zeroRowWide(),
			sql:        "SELECT * FROM A",
			dataType:   string(data.FrameTypeNumericWide),
			wantFields: []string{SQLMetricFieldName, SQLValueFieldName},
			wantRows:   0,
		},
	}

	for _, toggle := range toggles {
		t.Run(toggle.name, func(t *testing.T) {
			for _, tc := range panelCases {
				t.Run(tc.name, func(t *testing.T) {
					resp := map[string]backend.DataResponse{"A": {Frames: tc.frames}}
					s, req := newMockQueryServiceWithMetricsRegistry(resp, newDSAndSQLQueries(t, tc.sql, "", "A"), prometheus.NewPedanticRegistry())
					s.features = toggle.features

					pl, err := s.BuildPipeline(t.Context(), req)
					require.NoError(t, err)
					rsp, err := s.ExecutePipeline(t.Context(), time.Now(), pl)
					require.NoError(t, err)

					require.NoError(t, rsp.Responses["A"].Error)
					require.NoError(t, rsp.Responses["S"].Error)
					require.Len(t, rsp.Responses["S"].Frames, 1)
					out := rsp.Responses["S"].Frames[0]
					require.Equal(t, tc.wantFields, fieldNames(out))
					require.Equal(t, tc.wantRows, out.Rows())

					require.Equal(t, 1.0, counterVal(t, s.metrics.SqlCommandInputCount, "ok", "true", "test", tc.dataType)+
						counterVal(t, s.metrics.SqlCommandInputCount, "ok", "false", "test", tc.dataType))
				})
			}

			t.Run("alerting gets one number per label set", func(t *testing.T) {
				resp := map[string]backend.DataResponse{"A": {Frames: labeledMulti()}}
				s, req := newMockQueryService(resp, newDSAndSQLQueries(t,
					"SELECT host, MAX(__value__) AS v FROM A GROUP BY host ORDER BY host", "alerting", "A"))
				s.features = toggle.features

				pl, err := s.BuildPipeline(t.Context(), req)
				require.NoError(t, err)
				rsp, err := s.ExecutePipeline(t.Context(), time.Now(), pl)
				require.NoError(t, err)

				require.NoError(t, rsp.Responses["S"].Error)
				got := map[string]float64{}
				for _, f := range rsp.Responses["S"].Frames {
					require.Len(t, f.Fields, 1)
					v, err := f.Fields[0].FloatAt(0)
					require.NoError(t, err)
					got[f.Fields[0].Labels["host"]] = v
				}
				require.Equal(t, map[string]float64{"a": 2, "b": 4}, got)
			})

			t.Run("math input from the same data source is still converted", func(t *testing.T) {
				resp := map[string]backend.DataResponse{
					"A": {Frames: table()},
					"C": {Frames: data.Frames{data.NewFrame("",
						data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
						data.NewField("value", data.Labels{"host": "a"}, []float64{2}),
					)}},
				}
				queries := newDSAndSQLQueries(t, "SELECT * FROM A", "", "A", "C")
				queries = append(queries, Query{
					RefID:      "M",
					DataSource: dataSourceModel(),
					JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$C * 2" }`),
				})
				s, req := newMockQueryService(resp, queries)
				s.features = toggle.features

				pl, err := s.BuildPipeline(t.Context(), req)
				require.NoError(t, err)
				rsp, err := s.ExecutePipeline(t.Context(), time.Now(), pl)
				require.NoError(t, err)

				require.NoError(t, rsp.Responses["S"].Error)
				require.Len(t, rsp.Responses["S"].Frames, 1)
				require.Equal(t, []string{"a", "b"}, fieldNames(rsp.Responses["S"].Frames[0]))
				require.Equal(t, 2, rsp.Responses["S"].Frames[0].Rows())

				require.NoError(t, rsp.Responses["M"].Error)
				require.Len(t, rsp.Responses["M"].Frames, 1)
				m := rsp.Responses["M"].Frames[0]
				require.Equal(t, []string{"Time", "M"}, fieldNames(m))
				require.Equal(t, data.Labels{"host": "a"}, m.Fields[1].Labels)
				v, err := m.Fields[1].FloatAt(0)
				require.NoError(t, err)
				require.Equal(t, 4.0, v)
			})
		})
	}
}

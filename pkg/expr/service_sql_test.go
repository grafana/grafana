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

func TestSQLServiceInputNotices(t *testing.T) {
	truncated := data.Notice{Severity: data.NoticeSeverityWarning, Text: "Results truncated to 1 row"}
	mixed := data.Notice{Severity: data.NoticeSeverityInfo, Text: "Column x has mixed types"}
	maxPoints := data.Notice{Severity: data.NoticeSeverityWarning, Text: "Max data points reached"}

	newTable := func(notices ...data.Notice) *data.Frame {
		return data.NewFrame("",
			data.NewField("host", nil, []string{"a"}),
			data.NewField("value", nil, []*float64{new(2.0)}),
		).SetMeta(&data.FrameMeta{Notices: notices})
	}
	newSeries := func(host string, notices ...data.Notice) *data.Frame {
		return data.NewFrame("",
			data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
			data.NewField("value", data.Labels{"host": host}, []*float64{new(2.0)}),
		).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti, Notices: notices})
	}

	dsQuery := func(refID string) Query {
		return Query{
			RefID:      refID,
			DataSource: &datasources.DataSource{OrgID: 1, UID: "test", Type: "test"},
			JSON:       json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange:  AbsoluteTimeRange{},
		}
	}
	sqlQuery := func(q string) Query {
		return Query{
			RefID:      "S",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": "` + q + `" }`),
			TimeRange:  AbsoluteTimeRange{},
		}
	}

	run := func(t *testing.T, resp map[string]backend.DataResponse, queries ...Query) *backend.QueryDataResponse {
		t.Helper()
		s, req := newMockQueryService(resp, queries)
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)
		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)
		rsp, err := s.ExecutePipeline(t.Context(), time.Now(), pl)
		require.NoError(t, err)
		require.NoError(t, rsp.Responses["S"].Error)
		return rsp
	}

	notices := func(f *data.Frame) []data.Notice {
		if f.Meta == nil {
			return nil
		}
		return f.Meta.Notices
	}

	t.Run("table input notices reach the SQL output", func(t *testing.T) {
		resp := map[string]backend.DataResponse{
			"A": {Frames: data.Frames{newTable(truncated, mixed)}},
		}
		rsp := run(t, resp, dsQuery("A"), sqlQuery("SELECT * FROM A"))

		require.Len(t, rsp.Responses["S"].Frames, 1)
		require.Equal(t, []data.Notice{
			{Severity: data.NoticeSeverityWarning, Text: "A: Results truncated to 1 row"},
			{Severity: data.NoticeSeverityInfo, Text: "A: Column x has mixed types"},
		}, notices(rsp.Responses["S"].Frames[0]))
	})

	t.Run("notices from many inputs are deduplicated and keep their RefID", func(t *testing.T) {
		resp := map[string]backend.DataResponse{
			"A": {Frames: data.Frames{newTable(truncated, truncated)}},
			"B": {Frames: data.Frames{newSeries("a", maxPoints), newSeries("b", maxPoints, truncated)}},
		}
		rsp := run(t, resp, dsQuery("A"), dsQuery("B"), sqlQuery("SELECT COUNT(*) AS n FROM A, B"))

		require.Equal(t, []data.Notice{
			{Severity: data.NoticeSeverityWarning, Text: "A: Results truncated to 1 row"},
			{Severity: data.NoticeSeverityWarning, Text: "B: Max data points reached"},
			{Severity: data.NoticeSeverityWarning, Text: "B: Results truncated to 1 row"},
		}, notices(rsp.Responses["S"].Frames[0]))

		// The table input frame is not changed.
		require.Equal(t, []data.Notice{truncated, truncated}, notices(rsp.Responses["A"].Frames[0]))
	})

	t.Run("converted input keeps its own notices", func(t *testing.T) {
		resp := map[string]backend.DataResponse{
			"B": {Frames: data.Frames{newSeries("a", maxPoints), newSeries("b", maxPoints, truncated)}},
		}
		rsp := run(t, resp, dsQuery("B"), sqlQuery("SELECT * FROM B"))

		require.Equal(t, []data.Notice{maxPoints, truncated}, notices(rsp.Responses["B"].Frames[0]))
	})

	t.Run("notices reach a SQL output with no rows", func(t *testing.T) {
		resp := map[string]backend.DataResponse{
			"A": {Frames: data.Frames{newTable(truncated)}},
		}
		rsp := run(t, resp, dsQuery("A"), sqlQuery("SELECT * FROM A WHERE 1 = 0"))

		frame := rsp.Responses["S"].Frames[0]
		require.Equal(t, 0, frame.Rows())
		require.Len(t, frame.Fields, 2)
		require.Equal(t, []data.Notice{
			{Severity: data.NoticeSeverityWarning, Text: "A: Results truncated to 1 row"},
		}, notices(frame))
	})
}

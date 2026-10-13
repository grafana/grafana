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

func TestSQLServiceNullFromJSONFunction(t *testing.T) {
	// labels is non-nullable, as from Loki, and one row lacks the key.
	inputFrame := data.NewFrame("",
		data.NewField("line", nil, []string{"a", "b"}),
		data.NewField("labels", nil, []json.RawMessage{
			json.RawMessage(`{"level":"info"}`),
			json.RawMessage(`{}`),
		}),
	)

	resp := map[string]backend.DataResponse{
		"A": {Frames: data.Frames{inputFrame}},
	}

	sqlQuery := func(refID, q string) Query {
		escaped, err := json.Marshal(q)
		require.NoError(t, err)
		return Query{
			RefID:      refID,
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(fmt.Sprintf(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": %s }`, escaped)),
			TimeRange:  AbsoluteTimeRange{},
		}
	}

	queries := []Query{
		{
			RefID: "A",
			DataSource: &datasources.DataSource{
				OrgID: 1,
				UID:   "test",
				Type:  "test",
			},
			JSON:      json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange: AbsoluteTimeRange{},
		},
		sqlQuery("B", `SELECT JSON_UNQUOTE(JSON_EXTRACT(labels, '$.level')) AS level FROM A ORDER BY line`),
		sqlQuery("C", `SELECT COUNT(*) AS n FROM A`),
	}

	s, req := newMockQueryService(resp, queries)
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

	pl, err := s.BuildPipeline(t.Context(), req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	require.NoError(t, res.Responses["B"].Error)
	require.Len(t, res.Responses["B"].Frames, 1)
	level := res.Responses["B"].Frames[0].Fields[0]
	require.Equal(t, data.FieldTypeNullableString, level.Type())
	require.Equal(t, new("info"), level.At(0))
	require.Nil(t, level.At(1))

	require.NoError(t, res.Responses["C"].Error)
	require.Equal(t, int64(2), res.Responses["C"].Frames[0].Fields[0].At(0))
}

type panickingEndpoint struct {
	mockEndpoint
	panicRefID string
}

func (pe *panickingEndpoint) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	for _, q := range req.Queries {
		if q.RefID == pe.panicRefID {
			panic("runtime error: invalid memory address or nil pointer dereference")
		}
	}
	return pe.mockEndpoint.QueryData(ctx, req)
}

func TestSQLServiceDataSourcePanic(t *testing.T) {
	resp := map[string]backend.DataResponse{
		"B": {Frames: data.Frames{data.NewFrame("",
			data.NewField("value", nil, []float64{1}),
		)}},
	}

	dsQuery := func(refID, dsUID string) Query {
		return Query{
			RefID: refID,
			DataSource: &datasources.DataSource{
				OrgID: 1,
				UID:   dsUID,
				Type:  "test",
			},
			JSON:      json.RawMessage(`{ "datasource": { "uid": "` + dsUID + `" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
			TimeRange: AbsoluteTimeRange{},
		}
	}
	sqlQuery := func(refID, q string) Query {
		escaped, err := json.Marshal(q)
		require.NoError(t, err)
		return Query{
			RefID:      refID,
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(fmt.Sprintf(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": %s }`, escaped)),
			TimeRange:  AbsoluteTimeRange{},
		}
	}

	queries := []Query{
		dsQuery("A", "panics"),
		dsQuery("B", "works"),
		sqlQuery("S", `SELECT COUNT(*) AS n FROM B`),
		sqlQuery("T", `SELECT COUNT(*) AS n FROM A`),
	}

	for _, tc := range []struct {
		name     string
		features []any
	}{
		{name: "one request per data source node", features: []any{featuremgmt.FlagSqlExpressions}},
		{name: "grouped by data source", features: []any{featuremgmt.FlagSqlExpressions, featuremgmt.FlagSseGroupByDatasource}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, req := newMockQueryService(resp, queries)
			s.dataService = &panickingEndpoint{mockEndpoint: mockEndpoint{Responses: resp}, panicRefID: "A"}
			s.features = featuremgmt.WithFeatures(tc.features...)

			pl, err := s.BuildPipeline(t.Context(), req)
			require.NoError(t, err)

			res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
			require.NoError(t, err)

			require.ErrorContains(t, res.Responses["A"].Error, "[A]")
			require.ErrorContains(t, res.Responses["A"].Error, "panic")
			require.ErrorContains(t, res.Responses["A"].Error, "nil pointer dereference")

			require.NoError(t, res.Responses["B"].Error)
			require.Len(t, res.Responses["B"].Frames, 1)

			require.NoError(t, res.Responses["S"].Error)
			require.Equal(t, int64(1), res.Responses["S"].Frames[0].Fields[0].At(0))

			var sqlErr *sql.ErrorWithCategory
			require.ErrorAs(t, res.Responses["T"].Error, &sqlErr)
			require.Equal(t, sql.ErrCategoryDependency, sqlErr.Category())
		})
	}
}

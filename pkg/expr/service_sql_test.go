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
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
)

func TestSQLService(t *testing.T) {
	inputFrame := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", nil, []*float64{fp(2)}),
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
	})
}

func TestSQLServiceErrors(t *testing.T) {
	tsMulti := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"testLabelKey": "testLabelValue"}, []*float64{fp(2)}),
	).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})

	tsMultiNoType := data.NewFrame("",
		data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
		data.NewField("value", data.Labels{"testLabelKey": "testLabelValue"}, []*float64{fp(2)}),
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
		s, req := newMockQueryService(resp,
			newABSQLQueries(`SELECT * FROM tsMultiNoType`),
		)

		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		pl, err := s.BuildPipeline(t.Context(), req)
		require.NoError(t, err)

		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.Error(t, rsp.Responses["tsMultiNoType"].Error, "should return conversion error on DS response")
		require.ErrorContains(t, rsp.Responses["tsMultiNoType"].Error, "missing the data type")

		require.Error(t, rsp.Responses["sqlExpression"].Error, "should return dependency error")
		require.ErrorContains(t, rsp.Responses["sqlExpression"].Error, "dependency")
	})

	t.Run("pipeline (expressions and DS queries) will fail if the table is not found, before execution of the sql expression", func(t *testing.T) {
		s, req := newMockQueryService(resp,
			newABSQLQueries(`SELECT * FROM nonExisting`),
		)

		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		_, err := s.BuildPipeline(t.Context(), req)
		require.Error(t, err, "whole pipeline fails when selecting a dependency that does not exist")
	})

	t.Run("pipeline will fail if query is longer than the configured limit", func(t *testing.T) {
		s, req := newMockQueryService(resp,
			newABSQLQueries(`SELECT This is too long and does not need to be valid SQL`),
		)
		s.cfg.SQLExpressionQueryLengthLimit = 5
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)

		_, err := s.BuildPipeline(t.Context(), req)
		require.ErrorContains(t, err, "exceeded the configured limit of 5 characters")
	})
}

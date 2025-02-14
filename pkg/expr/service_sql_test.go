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
		q, err := jsonEscape(q)
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
				JSON:       json.RawMessage(fmt.Sprintf(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": "%s" }`, q)),
				TimeRange: AbsoluteTimeRange{
					From: time.Time{},
					To:   time.Time{},
				},
			},
		}
	}
	t.Run("no feature flag no queries for you", func(t *testing.T) {
		s, req := newMockQueryService(resp, newABSQLQueries(""))

		_, err := s.BuildPipeline(req)
		require.Error(t, err, "should not be able to build pipeline without feature flag")
	})

	t.Run("with feature flag basic select works", func(t *testing.T) {
		s, req := newMockQueryService(resp, newABSQLQueries("SELECT * FROM A"))
		s.features = featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions)
		pl, err := s.BuildPipeline(req)
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

		pl, err := s.BuildPipeline(req)
		require.NoError(t, err)

		rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
		require.NoError(t, err)

		require.Error(t, rsp.Responses["B"].Error, "should return invalid sql error")
		require.ErrorContains(t, rsp.Responses["B"].Error, "blocked function load_file")
	})
}

func jsonEscape(input string) (string, error) {
	escaped, err := json.Marshal(input)
	if err != nil {
		return "", err
	}
	// json.Marshal returns the escaped string with quotes, so we need to trim them
	return string(escaped[1 : len(escaped)-1]), nil
}

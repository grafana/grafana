package querydata_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
)

var update = false

func TestMatrixResponses(t *testing.T) {
	tt := []struct {
		name     string
		filepath string
	}{
		{name: "parse a simple matrix response", filepath: "range_simple"},
		{name: "parse a simple matrix response with value missing steps", filepath: "range_missing"},
		{name: "parse a response with Infinity", filepath: "range_infinity"},
		{name: "parse a response with NaN", filepath: "range_nan"},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			queryFileName := filepath.Join("../testdata", test.filepath+".query.json")
			responseFileName := filepath.Join("../testdata", test.filepath+".result.json")
			goldenFileName := filepath.Join("../testdata", test.filepath+".result.streaming.golden")

			query, err := loadStoredQuery(queryFileName)
			require.NoError(t, err)

			responseBytes, err := os.ReadFile(responseFileName)
			require.NoError(t, err)

			result, err := runQuery(responseBytes, query)
			require.NoError(t, err)
			require.Len(t, result.Responses, 1)

			dr, found := result.Responses["A"]
			require.True(t, found)

			actual, err := json.MarshalIndent(&dr, "", "  ")
			require.NoError(t, err)

			// nolint:gosec
			// We can ignore the gosec G304 because this is a test with static defined paths
			expected, err := ioutil.ReadFile(goldenFileName + ".json")
			if err != nil || update {
				err = os.WriteFile(goldenFileName+".json", actual, 0600)
				require.NoError(t, err)
			}

			require.JSONEq(t, string(expected), string(actual))

			require.NoError(t, experimental.CheckGoldenDataResponse(goldenFileName+".txt", &dr, update))
		})
	}
}

// we store the prometheus query data in a json file, here is some minimal code
// to be able to read it back. unfortunately we cannot use the models.Query
// struct here, because it has `time.time` and `time.duration` fields that
// cannot be unmarshalled from JSON automatically.
type storedPrometheusQuery struct {
	RefId      string
	RangeQuery bool
	Start      int64
	End        int64
	Step       int64
	Expr       string
}

func loadStoredQuery(fileName string) (*backend.QueryDataRequest, error) {
	bytes, err := os.ReadFile(fileName)
	if err != nil {
		return nil, err
	}

	var sq storedPrometheusQuery

	err = json.Unmarshal(bytes, &sq)
	if err != nil {
		return nil, err
	}

	qm := models.QueryModel{
		RangeQuery: sq.RangeQuery,
		Expr:       sq.Expr,
		Interval:   fmt.Sprintf("%ds", sq.Step),
		IntervalMS: sq.Step * 1000,
	}

	data, err := json.Marshal(&qm)
	if err != nil {
		return nil, err
	}

	return &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				TimeRange: backend.TimeRange{
					From: time.Unix(sq.Start, 0),
					To:   time.Unix(sq.End, 0),
				},
				RefID:    sq.RefId,
				Interval: time.Second * time.Duration(sq.Step),
				JSON:     json.RawMessage(data),
			},
		},
	}, nil
}

func runQuery(response []byte, q *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	tCtx := setup()
	res := &http.Response{
		StatusCode: 200,
		Body:       ioutil.NopCloser(bytes.NewReader(response)),
	}
	tCtx.httpProvider.setResponse(res)
	return tCtx.queryData.Execute(context.Background(), q)
}

type fakeLogger struct {
	log.Logger
}

func (fl *fakeLogger) Debug(testMessage string, ctx ...interface{}) {}
func (fl *fakeLogger) Info(testMessage string, ctx ...interface{})  {}
func (fl *fakeLogger) Warn(testMessage string, ctx ...interface{})  {}
func (fl *fakeLogger) Error(testMessage string, ctx ...interface{}) {}

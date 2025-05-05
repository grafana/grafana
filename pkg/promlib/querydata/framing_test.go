package querydata_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/promlib/models"
)

var update = false

func TestRangeResponses(t *testing.T) {
	tt := []struct {
		name     string
		filepath string
	}{
		{name: "parse a simple matrix response", filepath: "range_simple"},
		{name: "parse a simple matrix response with value missing steps", filepath: "range_missing"},
		{name: "parse a matrix response with Infinity", filepath: "range_infinity"},
		{name: "parse a matrix response with NaN", filepath: "range_nan"},
		{name: "parse a response with legendFormat __auto", filepath: "range_auto"},
	}

	for _, test := range tt {
		queryFileName := filepath.Join("../testdata", test.filepath+".query.json")
		responseFileName := filepath.Join("../testdata", test.filepath+".result.json")
		goldenFileName := test.filepath + ".result.golden"
		t.Run(test.name, goldenScenario(test.name, queryFileName, responseFileName, goldenFileName))
	}
}

func TestExemplarResponses(t *testing.T) {
	tt := []struct {
		name     string
		filepath string
	}{
		{name: "parse an exemplar response", filepath: "exemplar"},
	}

	for _, test := range tt {
		queryFileName := filepath.Join("../testdata", test.filepath+".query.json")
		responseFileName := filepath.Join("../testdata", test.filepath+".result.json")
		goldenFileName := test.filepath + ".result.golden"
		t.Run(test.name, goldenScenario(test.name, queryFileName, responseFileName, goldenFileName))
	}
}

func goldenScenario(name, queryFileName, responseFileName, goldenFileName string) func(t *testing.T) {
	return func(t *testing.T) {
		query, err := loadStoredQuery(queryFileName)
		require.NoError(t, err)

		//nolint:gosec
		responseBytes, err := os.ReadFile(responseFileName)
		require.NoError(t, err)

		result, err := runQuery(responseBytes, query)
		require.NoError(t, err)
		require.Len(t, result.Responses, 1)

		dr, found := result.Responses["A"]
		require.True(t, found)

		experimental.CheckGoldenJSONResponse(t, "../testdata", goldenFileName, &dr, update)
	}
}

// we store the prometheus query data in a json file, here is some minimal code
// to be able to read it back. unfortunately we cannot use the models.Query
// struct here, because it has `time.time` and `time.duration` fields that
// cannot be unmarshalled from JSON automatically.
type storedPrometheusQuery struct {
	RefId         string
	RangeQuery    bool
	ExemplarQuery bool
	Start         int64
	End           int64
	Step          int64
	Expr          string
	LegendFormat  string
}

func loadStoredQuery(fileName string) (*backend.QueryDataRequest, error) {
	//nolint:gosec
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
		PrometheusQueryProperties: models.PrometheusQueryProperties{
			Range:        sq.RangeQuery,
			Exemplar:     sq.ExemplarQuery,
			Expr:         sq.Expr,
			LegendFormat: sq.LegendFormat,
		},
		CommonQueryProperties: sdkapi.CommonQueryProperties{
			IntervalMS: float64(sq.Step * 1000),
		},
		Interval: fmt.Sprintf("%ds", sq.Step),
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
	tCtx, err := setup()
	if err != nil {
		return nil, err
	}

	// Create initial response
	res := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(bytes.NewReader(response)),
		Request: &http.Request{
			URL: &url.URL{
				Path: "api/v1/query_range",
			},
		},
	}

	// Create a proper clone for the exemplar response with a different path
	exemplarRes := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(bytes.NewReader(response)),
		Request: &http.Request{
			URL: &url.URL{
				Path: "api/v1/query_exemplars",
			},
		},
	}

	tCtx.httpProvider.setResponse(res, exemplarRes)

	// Add GrafanaConfig to the context to prevent nil pointer dereference
	ctx := backend.WithGrafanaConfig(context.Background(), backend.NewGrafanaCfg(map[string]string{
		"concurrent_query_count": "10",
	}))

	// Add a PluginContext with GrafanaConfig to the request
	q.PluginContext = backend.PluginContext{
		GrafanaConfig: backend.NewGrafanaCfg(map[string]string{
			"concurrent_query_count": "10",
		}),
	}

	return tCtx.queryData.Execute(ctx, q)
}

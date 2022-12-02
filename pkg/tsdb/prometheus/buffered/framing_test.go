package buffered

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

var update = true

func TestResponses(t *testing.T) {
	tt := []struct {
		name     string
		filepath string
	}{
		{name: "parse a simple matrix response", filepath: "range_simple"},
		{name: "parse a simple matrix response with value missing steps", filepath: "range_missing"},
		{name: "parse a matrix response with Infinity", filepath: "range_infinity"},
		{name: "parse a matrix response with NaN", filepath: "range_nan"},
		{name: "parse a response with legendFormat __auto", filepath: "range_auto"},
		{name: "parse an exemplar response", filepath: "exemplar"},
	}

	for _, test := range tt {
		t.Run(test.name, func(t *testing.T) {
			queryFileName := filepath.Join("../testdata", test.filepath+".query.json")
			responseFileName := filepath.Join("../testdata", test.filepath+".result.json")
			goldenFileName := test.filepath + ".result.golden"

			query, err := loadStoredPrometheusQuery(queryFileName)
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
		})
	}
}

type mockedRoundTripper struct {
	responseBytes []byte
}

func (mockedRT *mockedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(mockedRT.responseBytes)),
	}, nil
}

func makeMockedApi(responseBytes []byte) (apiv1.API, error) {
	roundTripper := mockedRoundTripper{responseBytes: responseBytes}

	cfg := api.Config{
		Address:      "http://localhost:9999",
		RoundTripper: &roundTripper,
	}

	client, err := api.NewClient(cfg)
	if err != nil {
		return nil, err
	}

	api := apiv1.NewAPI(client)

	return api, nil
}

// we store the prometheus query data in a json file, here is some minimal code
// to be able to read it back. unfortunately we cannot use the PrometheusQuery
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

func loadStoredPrometheusQuery(fileName string) (storedPrometheusQuery, error) {
	//nolint:gosec
	bytes, err := os.ReadFile(fileName)
	if err != nil {
		return storedPrometheusQuery{}, err
	}

	var sq storedPrometheusQuery
	err = json.Unmarshal(bytes, &sq)
	return sq, err
}

func runQuery(response []byte, sq storedPrometheusQuery) (*backend.QueryDataResponse, error) {
	api, err := makeMockedApi(response)
	if err != nil {
		return nil, err
	}

	tracer := tracing.InitializeTracerForTest()

	qm := QueryModel{
		RangeQuery:    sq.RangeQuery,
		ExemplarQuery: sq.ExemplarQuery,
		Expr:          sq.Expr,
		Interval:      fmt.Sprintf("%ds", sq.Step),
		IntervalMS:    sq.Step * 1000,
		LegendFormat:  sq.LegendFormat,
	}

	b := Buffered{
		intervalCalculator: intervalv2.NewCalculator(),
		tracer:             tracer,
		TimeInterval:       "15s",
		log:                &logtest.Fake{},
		client:             api,
	}

	data, err := json.Marshal(&qm)
	if err != nil {
		return nil, err
	}

	req := &backend.QueryDataRequest{
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
	}

	queries, err := b.parseTimeSeriesQuery(req)
	if err != nil {
		return nil, err
	}

	// parseTimeSeriesQuery forces range queries if the only query is an exemplar query
	// so we need to set it back to false
	if qm.ExemplarQuery {
		for i := range queries {
			queries[i].RangeQuery = false
		}
	}

	return b.runQueries(context.Background(), queries)
}

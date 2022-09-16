package buffered

import (
	"bytes"
	"context"
	"encoding/json"
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

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

var update = true

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
	RefId      string
	RangeQuery bool
	Start      int64
	End        int64
	Step       int64
	Expr       string
}

func loadStoredPrometheusQuery(fileName string) (PrometheusQuery, error) {
	//nolint:gosec
	bytes, err := os.ReadFile(fileName)
	if err != nil {
		return PrometheusQuery{}, err
	}

	var query storedPrometheusQuery

	err = json.Unmarshal(bytes, &query)
	if err != nil {
		return PrometheusQuery{}, err
	}

	return PrometheusQuery{
		RefId:      query.RefId,
		RangeQuery: query.RangeQuery,
		Start:      time.Unix(query.Start, 0),
		End:        time.Unix(query.End, 0),
		Step:       time.Second * time.Duration(query.Step),
		Expr:       query.Expr,
	}, nil
}

func runQuery(response []byte, query PrometheusQuery) (*backend.QueryDataResponse, error) {
	api, err := makeMockedApi(response)
	if err != nil {
		return nil, err
	}

	tracer := tracing.InitializeTracerForTest()

	s := Buffered{
		intervalCalculator: intervalv2.NewCalculator(),
		tracer:             tracer,
		TimeInterval:       "15s",
		log:                &fakeLogger{},
		client:             api,
	}
	return s.runQueries(context.Background(), []*PrometheusQuery{&query})
}

type fakeLogger struct {
	log.Logger
}

func (fl *fakeLogger) Debug(testMessage string, ctx ...interface{}) {}
func (fl *fakeLogger) Info(testMessage string, ctx ...interface{})  {}
func (fl *fakeLogger) Warn(testMessage string, ctx ...interface{})  {}
func (fl *fakeLogger) Error(testMessage string, ctx ...interface{}) {}

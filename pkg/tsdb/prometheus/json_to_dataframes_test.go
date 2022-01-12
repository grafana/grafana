package prometheus

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

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/require"
)

func TestMatrixResponses(t *testing.T) {
	t.Run("parse a simple matrix response", func(t *testing.T) {
		testScenario(t, "range_simple")
	})

	t.Run("parse a simple matrix response with value missing steps", func(t *testing.T) {
		testScenario(t, "range_missing")
	})

	t.Run("parse a response with Infinity", func(t *testing.T) {
		testScenario(t, "range_infinity")
	})

	t.Run("parse a response with NaN", func(t *testing.T) {
		testScenario(t, "range_nan")
	})
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

func loadStoredPrometheusQuery(t *testing.T, fileName string) PrometheusQuery {
	bytes, err := os.ReadFile(fileName)
	require.NoError(t, err)

	var query storedPrometheusQuery

	err = json.Unmarshal(bytes, &query)
	require.NoError(t, err)

	return PrometheusQuery{
		RefId:      query.RefId,
		RangeQuery: query.RangeQuery,
		Start:      time.Unix(query.Start, 0),
		End:        time.Unix(query.End, 0),
		Step:       time.Second * time.Duration(query.Step),
		Expr:       query.Expr,
	}
}

// we run the mocked query, and extract the DataResponse.
// we assume and verify that there is exactly one DataResponse returned.
func testScenario(t *testing.T, name string) {
	queryFileName := filepath.Join("testdata", name+".query.json")
	responseFileName := filepath.Join("testdata", name+".result.json")
	goldenFileName := filepath.Join("testdata", name+".result.golden.txt")
	query := loadStoredPrometheusQuery(t, queryFileName)
	responseBytes, err := os.ReadFile(responseFileName)
	require.NoError(t, err)

	api, err := makeMockedApi(responseBytes)
	require.NoError(t, err)

	result, err := runQueries(context.Background(), api, []*PrometheusQuery{&query})
	require.NoError(t, err)
	require.Len(t, result.Responses, 1)

	dr, found := result.Responses["A"]
	require.True(t, found)
	require.NoError(t, dr.Error)

	err = experimental.CheckGoldenDataResponse(goldenFileName, &dr, true)
	require.NoError(t, err)
}

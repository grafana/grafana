package prometheus

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

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/prometheus/client_golang/api"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/require"
)

func TestMatrixResponses(t *testing.T) {
	t.Run("parse a simple matrix response", func(t *testing.T) {
		err := testScenario("range_simple")
		require.NoError(t, err)
	})

	t.Run("parse a simple matrix response with value missing steps", func(t *testing.T) {
		err := testScenario("range_missing")
		require.NoError(t, err)
	})

	t.Run("parse a response with Infinity", func(t *testing.T) {
		err := testScenario("range_infinity")
		require.NoError(t, err)
	})

	t.Run("parse a response with NaN", func(t *testing.T) {
		err := testScenario("range_nan")
		require.NoError(t, err)
	})
}

// when memory-profiling this benchmark, these commands are recommended:
// - go test -benchmem -run=^$ -benchtime 1x -memprofile memprofile.out -memprofilerate 1 -bench ^BenchmarkJson$ github.com/grafana/grafana/pkg/tsdb/prometheus
// - go tool pprof -http=localhost:6061 memprofile.out
func BenchmarkJson(b *testing.B) {
	bytes, query := createJsonTestData(1642000000, 1, 300, 400)
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		result, err := runQuery(bytes, query)
		if err != nil {
			b.Error(err)
		}
		if len(result.Responses) != 1 {
			b.Error(fmt.Errorf("result.Responses length must be 1"))
		}

		dr, found := result.Responses["A"]
		if !found {
			b.Error(fmt.Errorf("result.Responses[A] not found"))
		}

		if dr.Error != nil {
			b.Error(dr.Error)
		}
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

	tracer, err := tracing.InitializeTracerForTest()
	if err != nil {
		return nil, err
	}

	s := Service{tracer: tracer}
	return s.runQueries(context.Background(), api, []*PrometheusQuery{&query})
}

// we run the mocked query, and extract the DataResponse.
// we assume and verify that there is exactly one DataResponse returned.
func testScenario(name string) error {
	queryFileName := filepath.Join("testdata", name+".query.json")
	responseFileName := filepath.Join("testdata", name+".result.json")
	goldenFileName := filepath.Join("testdata", name+".result.golden.txt")

	query, err := loadStoredPrometheusQuery(queryFileName)
	if err != nil {
		return err
	}

	responseBytes, err := os.ReadFile(responseFileName)
	if err != nil {
		return err
	}

	result, err := runQuery(responseBytes, query)
	if err != nil {
		return err
	}
	if len(result.Responses) != 1 {
		return fmt.Errorf("result.Responses length must be 1")
	}

	dr, found := result.Responses["A"]
	if !found {
		return fmt.Errorf("result.Responses[A] not found")
	}

	if dr.Error != nil {
		return dr.Error
	}

	return experimental.CheckGoldenDataResponse(goldenFileName, &dr, true)
}

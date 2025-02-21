package querydata_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/promlib/models"
)

// when memory-profiling this benchmark, these commands are recommended:
// - go test -benchmem -run=^$ -bench ^BenchmarkExemplarJson$ github.com/grafana/grafana/pkg/promlib/querydata -memprofile memprofile.out -count 6 | tee old.txt
// - go tool pprof -http=localhost:6061 memprofile.out
func BenchmarkExemplarJson(b *testing.B) {
	queryFileName := filepath.Join("../testdata", "exemplar.query.json")
	query, err := loadStoredQuery(queryFileName)
	require.NoError(b, err)

	responseFileName := filepath.Join("../testdata", "exemplar.result.json")

	// nolint:gosec
	// We can ignore the gosec G304 warning since this is a test file
	responseBytes, err := os.ReadFile(responseFileName)
	require.NoError(b, err)

	tCtx, err := setup()
	require.NoError(b, err)
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		res := http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader(responseBytes)),
		}
		tCtx.httpProvider.setResponse(&res, &res)
		resp, err := tCtx.queryData.Execute(context.Background(), query)
		require.NoError(b, err)
		for _, r := range resp.Responses {
			require.NoError(b, r.Error)
		}
	}
}

var resp *backend.QueryDataResponse

// when memory-profiling this benchmark, these commands are recommended:
// - go test -benchmem -run=^$ -bench ^BenchmarkRangeJson$ github.com/grafana/grafana/pkg/promlib/querydata -memprofile memprofile.out -count 6 | tee old.txt
// - go tool pprof -http=localhost:6061 memprofile.out
// - benchstat old.txt new.txt
func BenchmarkRangeJson(b *testing.B) {
	var (
		r   *backend.QueryDataResponse
		err error
	)
	body, q := createJsonTestData(1642000000, 1, 300, 400)
	tCtx, err := setup()
	require.NoError(b, err)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		res := http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader(body)),
		}
		tCtx.httpProvider.setResponse(&res, &res)
		r, err = tCtx.queryData.Execute(context.Background(), q)
		require.NoError(b, err)
	}

	resp = r
}

const nanRate = 0.002

// we build the JSON file from strings,
// it was easier to write it this way.
func makeJsonTestMetric(index int) string {
	return fmt.Sprintf(`{"server":"main","category":"maintenance","case":"%v"}`, index)
}

// return a value between -100 and +100, sometimes NaN, in string
func makeJsonTestValue(r *rand.Rand) string {
	if r.Float64() < nanRate {
		return "NaN"
	} else {
		return fmt.Sprintf("%f", (r.Float64()*200)-100)
	}
}

// create one time-series
func makeJsonTestSeries(start int64, step int64, timestampCount int, r *rand.Rand, seriesIndex int) string {
	var values []string
	for i := 0; i < timestampCount; i++ {
		// create out of order timestamps to test sorting
		if seriesIndex == 0 && i%2 == 0 {
			continue
		}
		value := fmt.Sprintf(`[%d,"%v"]`, start+(int64(i)*step), makeJsonTestValue(r))
		values = append(values, value)
	}
	return fmt.Sprintf(`{"metric":%v,"values":[%v]}`, makeJsonTestMetric(seriesIndex), strings.Join(values, ","))
}

func createJsonTestData(start int64, step int64, timestampCount int, seriesCount int) ([]byte, *backend.QueryDataRequest) {
	// we use random numbers as values, but they have to be the same numbers
	// every time we call this, so we create a random source.
	r := rand.New(rand.NewSource(42))
	var allSeries []string
	for i := 0; i < seriesCount; i++ {
		allSeries = append(allSeries, makeJsonTestSeries(start, step, timestampCount, r, i))
	}
	bytes := []byte(fmt.Sprintf(`{"status":"success","data":{"resultType":"matrix","result":[%v]}}`, strings.Join(allSeries, ",")))

	qm := models.QueryModel{
		PrometheusQueryProperties: models.PrometheusQueryProperties{
			Range: true,
			Expr:  "test",
		},
	}

	data, err := json.Marshal(&qm)
	if err != nil {
		panic(err)
	}

	res := backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				RefID: "A",
				TimeRange: backend.TimeRange{
					From: time.Unix(start, 0),
					To:   time.Unix(start+((int64(timestampCount)-1)*step), 0),
				},
				Interval: time.Second * time.Duration(step),
				JSON:     data,
			},
		},
	}

	return bytes, &res
}

package buffered

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/require"
)

// when memory-profiling this benchmark, these commands are recommended:
// - go test -benchmem -run=^$ -benchtime 1x -memprofile memprofile.out -memprofilerate 1 -bench ^BenchmarkJson$ github.com/grafana/grafana/pkg/tsdb/prometheus
// - go tool pprof -http=localhost:6061 memprofile.out
func BenchmarkJson(b *testing.B) {
	resp, query := createJsonTestData(1642000000, 1, 300, 400)

	api, err := makeMockedApi(resp)
	require.NoError(b, err)

	s := Buffered{tracer: tracing.InitializeTracerForTest(), log: &fakeLogger{}, client: api}

	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		_, err := s.runQueries(context.Background(), []*PrometheusQuery{&query})
		require.NoError(b, err)
	}
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

func createJsonTestData(start int64, step int64, timestampCount int, seriesCount int) ([]byte, PrometheusQuery) {
	// we use random numbers as values, but they have to be the same numbers
	// every time we call this, so we create a random source.
	r := rand.New(rand.NewSource(42))
	var allSeries []string
	for i := 0; i < seriesCount; i++ {
		allSeries = append(allSeries, makeJsonTestSeries(start, step, timestampCount, r, i))
	}
	bytes := []byte(fmt.Sprintf(`{"data":{"resultType":"matrix","result":[%v]},"status":"success"}`, strings.Join(allSeries, ",")))

	query := PrometheusQuery{
		RefId:      "A",
		RangeQuery: true,
		Start:      time.Unix(start, 0),
		End:        time.Unix(start+((int64(timestampCount)-1)*step), 0),
		Step:       time.Second * time.Duration(step),
		Expr:       "test",
	}

	return bytes, query
}

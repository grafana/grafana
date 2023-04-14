package loki

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"testing"
)

// when memory-profiling these benchmarks these commands are recommended
// - go test -benchmem -run=^$ -benchtime 1x -memprofile memprofile.out -memprofilerate 1 -bench ^BenchmarkMatrixJson$ github.com/grafana/grafana/pkg/tsdb/loki
// - go tool pprof -http=localhost:6061 memprofile.out
func BenchmarkMatrixJson(b *testing.B) {
	bytes := createJsonTestData(1642000000, 1, 300, 400)

	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		_, _ = runQuery(context.Background(), makeMockedAPI(http.StatusOK, "application/json", bytes, nil), &lokiQuery{}, ResponseOpts{})
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
		value := fmt.Sprintf(`[%d,"%v"]`, start+(int64(i)*step), makeJsonTestValue(r))
		values = append(values, value)
	}
	return fmt.Sprintf(`{"metric":%v,"values":[%v]}`, makeJsonTestMetric(seriesIndex), strings.Join(values, ","))
}

func createJsonTestData(start int64, step int64, timestampCount int, seriesCount int) []byte {
	// we use random numbers as values, but they have to be the same numbers
	// every time we call this, so we create a random source.
	r := rand.New(rand.NewSource(42))
	var allSeries []string
	for i := 0; i < seriesCount; i++ {
		allSeries = append(allSeries, makeJsonTestSeries(start, step, timestampCount, r, i))
	}
	return []byte(fmt.Sprintf(`{"data":{"resultType":"matrix","result":[%v]},"status":"success"}`, strings.Join(allSeries, ",")))
}

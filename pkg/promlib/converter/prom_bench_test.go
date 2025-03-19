package converter

import (
	"os"
	"testing"

	jsoniter "github.com/json-iterator/go"
)

// readTestData reads a JSON file from testdata directory
func readTestData(t *testing.B, filename string) []byte {
	// Can ignore gosec G304 here, because this is a constant defined below benchmark test
	// nolint:gosec
	data, err := os.ReadFile("testdata/" + filename)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// BenchmarkReadPrometheusStyleResult_FromFile benchmarks processing different test files
// go test -benchmem -run=^$ -bench=BenchmarkReadPrometheusStyleResult_FromFile$ github.com/grafana/grafana/pkg/promlib/converter/ -memprofile pmem.out -count 6 | tee pmem.0.txt
func BenchmarkReadPrometheusStyleResult_FromFile(b *testing.B) {
	testFiles := []string{
		"prom-query-range.json",
		"prom-query-range-big.json",
		"prom-matrix-histogram-partitioned.json",
	}

	opt := Options{}

	for _, tf := range testFiles {
		testData := readTestData(b, tf)
		iter := jsoniter.ParseBytes(jsoniter.ConfigDefault, testData)

		b.Run(tf, func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_ = ReadPrometheusStyleResult(iter, opt)
				iter.ResetBytes(testData)
			}
		})
	}
}

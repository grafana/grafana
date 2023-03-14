package influxdb

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// go test -benchmem -run=^$ -memprofile memprofile.out -count=10 -bench ^BenchmarkParseJson$ github.com/grafana/grafana/pkg/tsdb/influxdb
// go tool pprof -http=localhost:9999 memprofile.out
func BenchmarkParseJson(b *testing.B) {
	responseFileName := filepath.Join("./testdata", "response.json")

	// nolint:gosec
	// We can ignore the gosec G304 warning since this is a test file
	responseBytes, err := os.ReadFile(responseFileName)
	require.NoError(b, err)

	parser := &ResponseParser{}
	query := &Query{}

	require.NoError(b, err)
	b.ResetTimer()
	b.ReportAllocs()

	for n := 0; n < b.N; n++ {
		result := parser.Parse(prepare(string(responseBytes)), addQueryToQueries(*query))
		require.NotNil(b, result.Responses["A"].Frames)
		require.NoError(b, result.Responses["A"].Error)
	}
}

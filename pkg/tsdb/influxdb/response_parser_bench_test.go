package influxdb

import (
	_ "embed"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

//go:embed testdata/response.json
var testResponse string

// go test -benchmem -run=^$ -memprofile memprofile.out -count=10 -bench ^BenchmarkParseJson$ github.com/grafana/grafana/pkg/tsdb/influxdb
// go tool pprof -http=localhost:9999 memprofile.out
func BenchmarkParseJson(b *testing.B) {
	parser := &ResponseParser{}
	query := &Query{}
	queries := addQueryToQueries(*query)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		buf := strings.NewReader(testResponse)
		result := parser.parse(buf, queries)
		require.NotNil(b, result.Responses["A"].Frames)
		require.NoError(b, result.Responses["A"].Error)
	}
}

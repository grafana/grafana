package influxql

import (
	_ "embed"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

//go:embed testdata/response.json
var testResponse string

// go test -benchmem -run=^$ -memprofile memprofile.out -count=10 -bench ^BenchmarkParseJson$ github.com/grafana/grafana/pkg/tsdb/influxdb/influxql
// go tool pprof -http=localhost:9999 memprofile.out
func BenchmarkParseJson(b *testing.B) {
	query := generateQuery(models.Query{})

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		buf := strings.NewReader(testResponse)
		result := parse(buf, 200, query)
		require.NotNil(b, result.Frames)
		require.NoError(b, result.Error)
	}
}

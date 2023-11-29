package buffered

import (
	_ "embed"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// go test -benchmem -run=^$ -memprofile memprofile.out -count=10 -bench ^BenchmarkParseJson$ github.com/grafana/grafana/pkg/tsdb/influxdb/influxql
// go tool pprof -http=localhost:9999 memprofile.out
func BenchmarkParseJson(b *testing.B) {
	filePath := "../testdata/many_columns.json"
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		panic(fmt.Sprintf("cannot read the file: %s", filePath))
	}

	query := generateQuery("time_series", "")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		buf := strings.NewReader(string(bytes))
		result := parse(buf, 200, query)
		require.NotNil(b, result.Frames)
		require.NoError(b, result.Error)
	}
}

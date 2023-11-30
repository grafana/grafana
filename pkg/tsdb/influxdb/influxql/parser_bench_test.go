package influxql

import (
	_ "embed"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/buffered"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/querydata"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var useBuffered = false

// go test -benchmem -run=^$ -memprofile buffered_mem.out -count=10 -bench ^BenchmarkParseJson github.com/grafana/grafana/pkg/tsdb/influxdb/influxql | tee buffered.txt
// go tool pprof -http=localhost:9999 memprofile.out
// benchstat buffered.txt stream.txt
func BenchmarkParseJson(b *testing.B) {
	filePath := "testdata/many_columns.json"
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		panic(fmt.Sprintf("cannot read the file: %s", filePath))
	}

	query := &models.Query{
		RawQuery:    "Test raw query",
		UseRawQuery: true,
	}
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		buf := io.NopCloser(strings.NewReader(string(bytes)))
		var result *backend.DataResponse
		if useBuffered {
			result = buffered.ResponseParse(buf, 200, query)
		} else {
			result = querydata.ResponseParse(buf, 200, query)
		}
		require.NotNil(b, result.Frames)
		require.NoError(b, result.Error)
	}
}

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

// TEST_MODE=buffered go test -benchmem -run=^$ -memprofile buffered_mem.out -count=10 -bench ^BenchmarkParseJson github.com/grafana/grafana/pkg/tsdb/influxdb/influxql | tee buffered.txt
// TEST_MODE=stream go test -benchmem -run=^$ -memprofile stream_mem.out -count=10 -bench ^BenchmarkParseJson github.com/grafana/grafana/pkg/tsdb/influxdb/influxql | tee stream.txt
// go tool pprof -http=localhost:9999 memprofile.out
// benchstat buffered.txt stream.txt
func BenchmarkParseJson(b *testing.B) {
	filePath := "testdata/many_columns.json"
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		panic(fmt.Sprintf("cannot read the file: %s", filePath))
	}

	testMode := os.Getenv("TEST_MODE")
	if testMode == "" {
		testMode = "stream"
	}

	query := &models.Query{
		RawQuery:    "Test raw query",
		UseRawQuery: true,
	}
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		buf := io.NopCloser(strings.NewReader(string(bytes)))
		var result *backend.DataResponse
		switch testMode {
		case "buffered":
			result = buffered.ResponseParse(buf, 200, query, false)
		case "stream":
			result = querydata.ResponseParse(buf, 200, query)
		}
		require.NotNil(b, result.Frames)
		require.NoError(b, result.Error)
	}
}

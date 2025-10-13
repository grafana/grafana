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

// TEST_MODE=buffered RES_FORMAT=time_series go test -benchmem -run=^$ -memprofile buffered_mem.out -count=10 -bench ^BenchmarkParseJson github.com/grafana/grafana/pkg/tsdb/influxdb/influxql | tee buffered.txt
// TEST_MODE=stream RES_FORMAT=time_series go test -benchmem -run=^$ -memprofile stream_mem.out -count=10 -bench ^BenchmarkParseJson github.com/grafana/grafana/pkg/tsdb/influxdb/influxql | tee stream.txt
// TEST_MODE=buffered RES_FORMAT=table go test -benchmem -run=^$ -memprofile buffered_table_mem.out -cpuprofile buffered_table_cpu.out -count=10 -bench ^BenchmarkParseJson github.com/grafana/grafana/pkg/tsdb/influxdb/influxql | tee buffered_table.txt
// TEST_MODE=stream RES_FORMAT=table go test -benchmem -run=^$ -memprofile stream_table_mem.out -cpuprofile stream_table_cpu.out -count=10 -bench ^BenchmarkParseJson github.com/grafana/grafana/pkg/tsdb/influxdb/influxql | tee stream_table.txt
// go tool pprof -http=localhost:9999 memprofile.out
// benchstat buffered.txt stream.txt
// benchstat buffered_table.txt stream_table.txt
func BenchmarkParseJson(b *testing.B) {
	filePath := "testdata/many_columns.json"
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		panic(fmt.Sprintf("cannot read the file: %s", filePath))
	}

	testMode := os.Getenv("TEST_MODE")
	resFormat := os.Getenv("RES_FORMAT")
	if testMode == "" {
		testMode = "stream"
	}

	query := &models.Query{
		RawQuery:     "Test raw query",
		UseRawQuery:  true,
		ResultFormat: resFormat,
	}
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		buf := io.NopCloser(strings.NewReader(string(bytes)))
		var result *backend.DataResponse
		switch testMode {
		case "buffered":
			result = buffered.ResponseParse(buf, 200, query)
		case "stream":
			result = querydata.ResponseParse(buf, 200, query)
		}
		require.NotNil(b, result.Frames)
		require.NoError(b, result.Error)
	}
}

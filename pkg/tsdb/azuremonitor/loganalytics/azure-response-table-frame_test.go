package loganalytics

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/testdata"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogTableToFrame(t *testing.T) {
	tests := []struct {
		name          string
		testFile      string
		expectedFrame func() *data.Frame
	}{
		{
			name:     "single series",
			testFile: "loganalytics/1-log-analytics-response-metrics-single-series.json",
		},
		{
			name:     "response table",
			testFile: "loganalytics/6-log-analytics-response-table.json",
		},
		{
			name:     "all supported field types",
			testFile: "loganalytics/7-log-analytics-all-types-table.json",
		},
		{
			name:     "nan and infinity in real response",
			testFile: "loganalytics/8-log-analytics-response-nan-inf.json",
		},
		{
			name:     "data and error in real response",
			testFile: "loganalytics/9-log-analytics-response-error.json",
		},
		{
			name:     "data and warning in real response",
			testFile: "loganalytics/10-log-analytics-response-warning.json",
		},
		{
			name:     "empty data response",
			testFile: "loganalytics/11-log-analytics-response-empty.json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := loadTestFileWithNumber(t, tt.testFile)
			frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", dataquery.AzureQueryTypeAzureLogAnalytics, dataquery.ResultFormatTable)
			appendErrorNotice(frame, res.Error)
			require.NoError(t, err)

			testdata.CheckGoldenFrame(t, "../testdata", tt.testFile, frame)
		})
	}
}

func TestTraceTableToFrame(t *testing.T) {
	tests := []struct {
		name          string
		testFile      string
		expectedFrame func() *data.Frame
		resultFormat  dataquery.ResultFormat
	}{
		{
			name:         "multi trace",
			testFile:     "traces/1-traces-multiple-table.json",
			resultFormat: dataquery.ResultFormatTable,
		},
		{
			name:         "multi trace as trace format",
			testFile:     "traces/1-traces-multiple-table.json",
			resultFormat: dataquery.ResultFormatTrace,
		},
		{
			name:         "single trace",
			testFile:     "traces/2-traces-single-table.json",
			resultFormat: dataquery.ResultFormatTable,
		},
		{
			name:         "single trace as trace format",
			testFile:     "traces/2-traces-single-table.json",
			resultFormat: dataquery.ResultFormatTrace,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := loadTestFileWithNumber(t, tt.testFile)
			frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", dataquery.AzureQueryTypeAzureTraces, tt.resultFormat)
			appendErrorNotice(frame, res.Error)
			require.NoError(t, err)

			testdata.CheckGoldenFrame(t, "../testdata", fmt.Sprintf("%s.%s", tt.testFile, strings.ReplaceAll(tt.name, " ", "-")), frame)
		})
	}
}

func loadTestFileWithNumber(t *testing.T, name string) AzureLogAnalyticsResponse {
	t.Helper()
	path := filepath.Join("../testdata", name)
	// Ignore gosec warning G304 since it's a test
	// nolint:gosec
	f, err := os.Open(path)
	require.NoError(t, err)
	defer func() {
		err := f.Close()
		assert.NoError(t, err)
	}()

	d := json.NewDecoder(f)
	d.UseNumber()
	var data AzureLogAnalyticsResponse
	err = d.Decode(&data)
	require.NoError(t, err)
	return data
}

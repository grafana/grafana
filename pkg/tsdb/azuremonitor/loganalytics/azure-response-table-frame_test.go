package loganalytics

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/testdata"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
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
			frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", dataquery.AzureQueryTypeAzureLogAnalytics, dataquery.ResultFormatTable, false)
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
		queryType     dataquery.AzureQueryType
	}{
		{
			name:         "multi trace",
			testFile:     "traces/1-traces-multiple-table.json",
			resultFormat: dataquery.ResultFormatTable,
			queryType:    dataquery.AzureQueryTypeAzureTraces,
		},
		{
			name:         "multi trace as trace format",
			testFile:     "traces/1-traces-multiple-table.json",
			resultFormat: dataquery.ResultFormatTrace,
			queryType:    dataquery.AzureQueryTypeAzureTraces,
		},
		{
			name:         "single trace",
			testFile:     "traces/2-traces-single-table.json",
			resultFormat: dataquery.ResultFormatTable,
			queryType:    dataquery.AzureQueryTypeAzureTraces,
		},
		{
			name:         "single trace as trace format",
			testFile:     "traces/2-traces-single-table.json",
			resultFormat: dataquery.ResultFormatTrace,
			queryType:    dataquery.AzureQueryTypeAzureTraces,
		},
		{
			name:         "single trace with empty serviceTags and tags",
			testFile:     "traces/3-traces-empty-dynamics.json",
			resultFormat: dataquery.ResultFormatTrace,
			queryType:    dataquery.AzureQueryTypeAzureTraces,
		},
		{
			name:         "single trace as trace format from exemplars query",
			testFile:     "traces/2-traces-single-table.json",
			resultFormat: dataquery.ResultFormatTrace,
			queryType:    dataquery.AzureQueryTypeTraceql,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := loadTestFileWithNumber(t, tt.testFile)
			frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", tt.queryType, tt.resultFormat, false)
			appendErrorNotice(frame, res.Error)
			require.NoError(t, err)

			testdata.CheckGoldenFrame(t, "../testdata", fmt.Sprintf("%s.%s", tt.testFile, strings.ReplaceAll(tt.name, " ", "-")), frame)
		})
	}
}

func TestLargeLogsResponse(t *testing.T) {
	t.Run("large logs response with limit enabled", func(t *testing.T) {
		res := AzureLogAnalyticsResponse{
			Tables: []types.AzureResponseTable{
				{Name: "PrimaryResult",
					Columns: []struct {
						Name string `json:"name"`
						Type string `json:"type"`
					}{
						{Name: "value", Type: "int"},
					}},
			},
		}
		rows := [][]any{}
		for i := 0; i <= 30000; i++ {
			rows = append(rows, []any{json.Number(strconv.Itoa(i))})
		}
		res.Tables[0].Rows = rows
		resultFormat := dataquery.ResultFormatLogs
		frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", dataquery.AzureQueryTypeAzureLogAnalytics, resultFormat, false)
		appendErrorNotice(frame, res.Error)
		require.NoError(t, err)
		require.Equal(t, frame.Rows(), 30000)
		require.Len(t, frame.Meta.Notices, 1)
		require.Equal(t, frame.Meta.Notices[0], data.Notice{
			Severity: data.NoticeSeverityWarning,
			Text:     "The number of results in the result set has been limited to 30,000.",
		})
	})

	t.Run("large logs response with limit disabled", func(t *testing.T) {
		res := AzureLogAnalyticsResponse{
			Tables: []types.AzureResponseTable{
				{Name: "PrimaryResult",
					Columns: []struct {
						Name string `json:"name"`
						Type string `json:"type"`
					}{
						{Name: "value", Type: "int"},
					}},
			},
		}
		rows := [][]any{}
		for i := 0; i < 40000; i++ {
			rows = append(rows, []any{json.Number(strconv.Itoa(i))})
		}
		res.Tables[0].Rows = rows
		resultFormat := dataquery.ResultFormatLogs
		frame, err := ResponseTableToFrame(&res.Tables[0], "A", "query", dataquery.AzureQueryTypeAzureLogAnalytics, resultFormat, true)
		appendErrorNotice(frame, res.Error)
		require.NoError(t, err)
		require.Equal(t, frame.Rows(), 40000)
		require.Nil(t, frame.Meta.Notices)
	})
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

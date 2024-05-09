package loganalytics

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/stretchr/testify/assert"
)

func TestParseResultFormat(t *testing.T) {
	emptyResultFormat := dataquery.ResultFormat("")
	traceFormat := dataquery.ResultFormatTrace
	testCases := []struct {
		name                 string
		queryResultFormat    *dataquery.ResultFormat
		queryType            dataquery.AzureQueryType
		expectedResultFormat dataquery.ResultFormat
	}{
		{
			name:                 "returns the logs format as default for logs queries if input format is nil",
			queryResultFormat:    nil,
			queryType:            dataquery.AzureQueryTypeAzureLogAnalytics,
			expectedResultFormat: dataquery.ResultFormatLogs,
		},
		{
			name:                 "returns the table format as default for traces queries if input format is nil",
			queryResultFormat:    nil,
			queryType:            dataquery.AzureQueryTypeAzureTraces,
			expectedResultFormat: dataquery.ResultFormatTable,
		},
		{
			name:                 "returns the logs format as default for logs queries if input format is empty",
			queryResultFormat:    &emptyResultFormat,
			queryType:            dataquery.AzureQueryTypeAzureLogAnalytics,
			expectedResultFormat: dataquery.ResultFormatLogs,
		},
		{
			name:                 "returns the table format as default for traces queries if input format is empty",
			queryResultFormat:    &emptyResultFormat,
			queryType:            dataquery.AzureQueryTypeAzureTraces,
			expectedResultFormat: dataquery.ResultFormatTable,
		},
		{
			name:                 "returns the query result format",
			queryResultFormat:    &traceFormat,
			queryType:            dataquery.AzureQueryTypeAzureTraces,
			expectedResultFormat: dataquery.ResultFormatTrace,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rf := ParseResultFormat(tc.queryResultFormat, tc.queryType)
			assert.Equal(t, tc.expectedResultFormat, rf)
		})
	}
}

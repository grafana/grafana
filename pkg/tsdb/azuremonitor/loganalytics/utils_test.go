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
			name:                 "returns the time series format as default for logs queries if input format is nil",
			queryResultFormat:    nil,
			queryType:            dataquery.AzureQueryTypeLogAnalytics,
			expectedResultFormat: dataquery.ResultFormatTimeSeries,
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
			queryType:            dataquery.AzureQueryTypeLogAnalytics,
			expectedResultFormat: dataquery.ResultFormatTimeSeries,
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

func TestRetrieveResources(t *testing.T) {
	legacyResource := "test-single-resource"
	legacyWorkspace := "test-workspace"
	testCases := []struct {
		name                        string
		query                       dataquery.AzureLogsQuery
		expectedResources           []string
		expectedResourceOrWorkspace string
	}{
		{
			name: "current resource query returns the resources and the first resource",
			query: dataquery.AzureLogsQuery{
				Resources: []string{"test-resource"},
			},
			expectedResources:           []string{"test-resource"},
			expectedResourceOrWorkspace: "test-resource",
		},
		{
			name: "legacy query with resource specified",
			query: dataquery.AzureLogsQuery{
				Resource: &legacyResource,
			},
			expectedResources:           []string{"test-single-resource"},
			expectedResourceOrWorkspace: "test-single-resource",
		},
		{
			name: "legacy query with workspace specified",
			query: dataquery.AzureLogsQuery{
				Workspace: &legacyWorkspace,
			},
			expectedResources:           []string{},
			expectedResourceOrWorkspace: "test-workspace",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resources, resourceOrWorkspace := retrieveResources(tc.query)
			assert.Equal(t, tc.expectedResources, resources)
			assert.Equal(t, tc.expectedResourceOrWorkspace, resourceOrWorkspace)
		})
	}
}

func TestMeetsSearchLogsCriteria(t *testing.T) {
	workspaceResource := []string{"/subscriptions/abc/resourceGroups/rg/providers/microsoft.operationalinsights/workspaces/ws"}
	storageResource := []string{"/subscriptions/abc/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa"}

	testCases := []struct {
		name           string
		resources      []string
		fromAlert      bool
		logsEnabled    bool
		logTier        dataquery.AzureLogsQueryLogTier
		expectedResult bool
		expectedError  string
	}{
		{
			name:           "returns true when basic/auxiliary logs enabled and single workspace",
			resources:      workspaceResource,
			fromAlert:      false,
			logsEnabled:    true,
			logTier:        dataquery.AzureLogsQueryLogTierBasic,
			expectedResult: true,
		},
		{
			name:          "returns a tier-specific error when logs are not enabled",
			resources:     workspaceResource,
			fromAlert:     false,
			logsEnabled:   false,
			logTier:       dataquery.AzureLogsQueryLogTierAuxiliary,
			expectedError: "Auxiliary Logs queries are disabled for this data source",
		},
		{
			name:          "returns a tier-specific error for alerts",
			resources:     workspaceResource,
			fromAlert:     true,
			logsEnabled:   true,
			logTier:       dataquery.AzureLogsQueryLogTierAuxiliary,
			expectedError: "Auxiliary Logs queries cannot be used for alerts",
		},
		{
			name:          "returns a tier-specific error for non-workspace resources",
			resources:     storageResource,
			fromAlert:     false,
			logsEnabled:   true,
			logTier:       dataquery.AzureLogsQueryLogTierAuxiliary,
			expectedError: "Auxiliary Logs queries may only be run against Log Analytics workspaces",
		},
		{
			name:          "returns a tier-specific error for multiple resources",
			resources:     append(workspaceResource, workspaceResource...),
			fromAlert:     false,
			logsEnabled:   true,
			logTier:       dataquery.AzureLogsQueryLogTierAuxiliary,
			expectedError: "Auxiliary Logs queries cannot be run against multiple resources",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := meetsSearchLogsCriteria(tc.resources, tc.fromAlert, tc.logsEnabled, tc.logTier)
			assert.Equal(t, tc.expectedResult, result)
			if tc.expectedError != "" {
				assert.EqualError(t, err, tc.expectedError)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

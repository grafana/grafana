package loganalytics

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
)

func AddCustomDataLink(frame data.Frame, dataLink data.DataLink) data.Frame {
	for i := range frame.Fields {
		if frame.Fields[i].Config == nil {
			frame.Fields[i].Config = &data.FieldConfig{}
		}

		frame.Fields[i].Config.Links = append(frame.Fields[i].Config.Links, dataLink)
	}
	return frame
}

func AddConfigLinks(frame data.Frame, dl string, title *string) data.Frame {
	linkTitle := "View query in Azure Portal"
	if title != nil {
		linkTitle = *title
	}

	deepLink := data.DataLink{
		Title:       linkTitle,
		TargetBlank: true,
		URL:         dl,
	}

	frame = AddCustomDataLink(frame, deepLink)

	return frame
}

// Check whether a query should be handled as basic logs query
// 1. resource selected is a workspace
// 2. query is not an alerts query
// 3. number of selected resources is exactly one
// 4. the ds toggle is set to true
func meetsBasicLogsCriteria(resources []string, fromAlert bool, basicLogsEnabled bool) (bool, error) {
	if fromAlert {
		return false, backend.DownstreamError(fmt.Errorf("basic Logs queries cannot be used for alerts"))
	}
	if len(resources) != 1 {
		return false, backend.DownstreamError(fmt.Errorf("basic logs queries cannot be run against multiple resources"))
	}

	if !strings.Contains(strings.ToLower(resources[0]), "microsoft.operationalinsights/workspaces") {
		return false, backend.DownstreamError(fmt.Errorf("basic logs queries may only be run against Log Analytics workspaces"))
	}

	if !basicLogsEnabled {
		return false, backend.DownstreamError(fmt.Errorf("basic Logs queries are disabled for this data source"))
	}

	return true, nil
}

// This function should be part of migration function
func ParseResultFormat(queryResultFormat *dataquery.ResultFormat, queryType dataquery.AzureQueryType) dataquery.ResultFormat {
	if queryResultFormat != nil && *queryResultFormat != "" {
		return *queryResultFormat
	}
	if queryType == dataquery.AzureQueryTypeLogAnalytics {
		// Default to time series format for logs queries. It was time series before this change
		return dataquery.ResultFormatTimeSeries
	}
	if queryType == dataquery.AzureQueryTypeAzureTraces {
		// Default to table format for traces queries as many traces may be returned
		return dataquery.ResultFormatTable
	}
	return ""
}

func getApiURL(resourceOrWorkspace string, isAppInsightsQuery bool, basicLogsQuery bool) string {
	matchesResourceURI, _ := regexp.MatchString("^/subscriptions/", resourceOrWorkspace)

	queryOrSearch := "query"
	if basicLogsQuery {
		queryOrSearch = "search"
	}

	if matchesResourceURI {
		if isAppInsightsQuery {
			componentName := resourceOrWorkspace[strings.LastIndex(resourceOrWorkspace, "/")+1:]
			return fmt.Sprintf("v1/apps/%s/query", componentName)
		}
		return fmt.Sprintf("v1%s/%s", resourceOrWorkspace, queryOrSearch)
	} else {
		return fmt.Sprintf("v1/workspaces/%s/%s", resourceOrWorkspace, queryOrSearch)
	}
}

// Legacy queries only specify a Workspace GUID, which we need to use the old workspace-centric
// API URL for, and newer queries specifying a resource URI should use resource-centric API.
// However, legacy workspace queries using a `workspaces()` template variable will be resolved
// to a resource URI, so they should use the new resource-centric.
func retrieveResources(query dataquery.AzureLogsQuery) ([]string, string) {
	resources := []string{}
	var resourceOrWorkspace string
	if len(query.Resources) > 0 {
		resources = query.Resources
		resourceOrWorkspace = query.Resources[0]
	} else if query.Resource != nil && *query.Resource != "" {
		resources = []string{*query.Resource}
		resourceOrWorkspace = *query.Resource
	} else if query.Workspace != nil {
		resourceOrWorkspace = *query.Workspace
	}

	return resources, resourceOrWorkspace
}

func ConvertTime(timeStamp string) (time.Time, error) {
	// Convert the timestamp string to an int64
	timestampInt, err := strconv.ParseInt(timeStamp, 10, 64)
	if err != nil {
		// Handle error
		return time.Time{}, err
	}

	// Convert the Unix timestamp (in milliseconds) to a time.Time
	convTimeStamp := time.Unix(0, timestampInt*int64(time.Millisecond))

	return convTimeStamp, nil
}

func GetDataVolumeRawQuery(table string) string {
	return fmt.Sprintf("Usage \n| where DataType == \"%s\"\n| where IsBillable == true\n| summarize BillableDataGB = round(sum(Quantity) / 1000, 3)", table)
}

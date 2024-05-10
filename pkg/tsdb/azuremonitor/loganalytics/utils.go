package loganalytics

import (
	"fmt"
	"regexp"
	"strings"

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

func ParseResultFormat(queryResultFormat *dataquery.ResultFormat, queryType dataquery.AzureQueryType) dataquery.ResultFormat {
	var resultFormat dataquery.ResultFormat
	if queryResultFormat != nil {
		resultFormat = *queryResultFormat
	}
	if resultFormat == "" {
		if queryType == dataquery.AzureQueryTypeAzureLogAnalytics {
			// Default to logs format for logs queries
			resultFormat = dataquery.ResultFormatLogs
		}
		if queryType == dataquery.AzureQueryTypeAzureTraces {
			// Default to table format for traces queries as many traces may be returned
			resultFormat = dataquery.ResultFormatTable
		}
	}
	return resultFormat
}

func getApiURL(resourceOrWorkspace string, isAppInsightsQuery bool) string {
	matchesResourceURI, _ := regexp.MatchString("^/subscriptions/", resourceOrWorkspace)

	if matchesResourceURI {
		if isAppInsightsQuery {
			componentName := resourceOrWorkspace[strings.LastIndex(resourceOrWorkspace, "/")+1:]
			return fmt.Sprintf("v1/apps/%s/query", componentName)
		}
		return fmt.Sprintf("v1%s/query", resourceOrWorkspace)
	} else {
		return fmt.Sprintf("v1/workspaces/%s/query", resourceOrWorkspace)
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

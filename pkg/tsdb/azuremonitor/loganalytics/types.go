package loganalytics

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

// AzureLogAnalyticsDatasource calls the Azure Log Analytics API's
type AzureLogAnalyticsDatasource struct {
	Proxy  types.ServiceProxy
	Logger log.Logger
}

// AzureLogAnalyticsQuery is the query request that is built from the saved values for
// from the UI
type AzureLogAnalyticsQuery struct {
	RefID                   string
	ResultFormat            dataquery.ResultFormat
	URL                     string
	TraceExploreQuery       string
	TraceParentExploreQuery string
	TraceLogsExploreQuery   string
	JSON                    json.RawMessage
	TimeRange               backend.TimeRange
	Query                   string
	Resources               []string
	QueryType               dataquery.AzureQueryType
	AppInsightsQuery        bool
	DashboardTime           bool
	TimeColumn              string
	BasicLogs               bool
}

// Error definition has been inferred from real data and other model definitions like
// https://github.com/Azure/azure-sdk-for-go/blob/3640559afddbad452d265b54fb1c20b30be0b062/services/preview/virtualmachineimagebuilder/mgmt/2019-05-01-preview/virtualmachineimagebuilder/models.go
type AzureLogAnalyticsAPIError struct {
	Details *[]AzureLogAnalyticsAPIErrorBase `json:"details,omitempty"`
	Code    *string                          `json:"code,omitempty"`
	Message *string                          `json:"message,omitempty"`
}

type AzureLogAnalyticsAPIErrorBase struct {
	Code       *string                      `json:"code,omitempty"`
	Message    *string                      `json:"message,omitempty"`
	Innererror *AzureLogAnalyticsInnerError `json:"innererror,omitempty"`
}

type AzureLogAnalyticsInnerError struct {
	Code         *string `json:"code,omitempty"`
	Message      *string `json:"message,omitempty"`
	Severity     *int    `json:"severity,omitempty"`
	SeverityName *string `json:"severityName,omitempty"`
}

// AzureLogAnalyticsResponse is the json response object from the Azure Log Analytics API.
type AzureLogAnalyticsResponse struct {
	Tables []types.AzureResponseTable `json:"tables"`
	Error  *AzureLogAnalyticsAPIError `json:"error,omitempty"`
}

type AzureCorrelationAPIResponse struct {
	ID         string                                `json:"id"`
	Name       string                                `json:"name"`
	Type       string                                `json:"type"`
	Properties AzureCorrelationAPIResponseProperties `json:"properties"`
	Error      *AzureLogAnalyticsAPIError            `json:"error,omitempty"`
}

type AzureCorrelationAPIResponseProperties struct {
	Resources []string `json:"resources"`
	NextLink  *string  `json:"nextLink,omitempty"`
}

// BasicLogsUsagePayload is the payload that the frontend resourcerequest will send to the backend to calculate the basic logs query usage
type BasicLogsUsagePayload struct {
	Table     string `json:"table"`
	Resource  string `json:"resource"`
	QueryType string `json:"queryType"`
	From      string `json:"from"`
	To        string `json:"to"`
}

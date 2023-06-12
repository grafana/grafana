package types

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/azcredentials"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
)

const (
	TimeSeries = "time_series"
	Table      = "table"
	Trace      = "trace"
)

var (
	LegendKeyFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

type AzRoute struct {
	URL     string
	Scopes  []string
	Headers map[string]string
}

type AzureSettings struct {
	AzureMonitorSettings
	AzureClientSettings
}

type AzureMonitorSettings struct {
	SubscriptionId               string `json:"subscriptionId"`
	LogAnalyticsDefaultWorkspace string `json:"logAnalyticsDefaultWorkspace"`
	AppInsightsAppId             string `json:"appInsightsAppId"`
}

type AzureClientSettings struct {
	AzureAuthType string
	CloudName     string
	TenantId      string
	ClientId      string
}

// AzureMonitorCustomizedCloudSettings is the extended Azure Monitor settings for customized cloud
type AzureMonitorCustomizedCloudSettings struct {
	CustomizedRoutes map[string]AzRoute `json:"customizedRoutes"`
}

type DatasourceService struct {
	URL        string
	HTTPClient *http.Client
}

type DatasourceInfo struct {
	Cloud       string
	Credentials azcredentials.AzureCredentials
	Settings    AzureMonitorSettings
	Routes      map[string]AzRoute
	Services    map[string]DatasourceService

	JSONData                map[string]interface{}
	DecryptedSecureJSONData map[string]string
	DatasourceID            int64
	OrgID                   int64

	DatasourceName string
	DatasourceUID  string
}

// AzureMonitorQuery is the query for all the services as they have similar queries
// with a url, a querystring and an alias field
type AzureMonitorQuery struct {
	URL          string
	Target       string
	Params       url.Values
	RefID        string
	Alias        string
	TimeRange    backend.TimeRange
	BodyFilter   string
	Dimensions   []dataquery.AzureMetricDimension
	Resources    map[string]dataquery.AzureMonitorResource
	Subscription string
}

// AzureMonitorResponse is the json response from the Azure Monitor API
type AzureMonitorResponse struct {
	Cost     int    `json:"cost"`
	Timespan string `json:"timespan"`
	Interval string `json:"interval"`
	Value    []struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Name struct {
			Value          string `json:"value"`
			LocalizedValue string `json:"localizedValue"`
		} `json:"name"`
		Unit       string `json:"unit"`
		Timeseries []struct {
			Metadatavalues []struct {
				Name struct {
					Value          string `json:"value"`
					LocalizedValue string `json:"localizedValue"`
				} `json:"name"`
				Value string `json:"value"`
			} `json:"metadatavalues"`
			Data []struct {
				TimeStamp time.Time `json:"timeStamp"`
				Average   *float64  `json:"average,omitempty"`
				Total     *float64  `json:"total,omitempty"`
				Count     *float64  `json:"count,omitempty"`
				Maximum   *float64  `json:"maximum,omitempty"`
				Minimum   *float64  `json:"minimum,omitempty"`
			} `json:"data"`
		} `json:"timeseries"`
	} `json:"value"`
	Namespace      string `json:"namespace"`
	Resourceregion string `json:"resourceregion"`
}

// AzureResponseTable is the table format for Azure responses
type AzureResponseTable struct {
	Name    string `json:"name"`
	Columns []struct {
		Name string `json:"name"`
		Type string `json:"type"`
	} `json:"columns"`
	Rows [][]interface{} `json:"rows"`
}

type AzureMonitorResource struct {
	ResourceGroup string `json:"resourceGroup"`
	ResourceName  string `json:"resourceName"`
}

type AzureMonitorDimensionFilterBackend struct {
	Key      string   `json:"key"`
	Operator int      `json:"operator"`
	Values   []string `json:"values"`
}

func ConstructFiltersString(a dataquery.AzureMetricDimension) string {
	var filterStrings []string
	for _, filter := range a.Filters {
		dimension := ""
		operator := ""
		if a.Dimension != nil {
			dimension = *a.Dimension
		}
		if a.Operator != nil {
			operator = *a.Operator
		}
		filterStrings = append(filterStrings, fmt.Sprintf("%v %v '%v'", dimension, operator, filter))
	}
	if a.Operator != nil && *a.Operator == "eq" {
		return strings.Join(filterStrings, " or ")
	}
	return strings.Join(filterStrings, " and ")
}

// LogJSONQuery is the frontend JSON query model for an Azure Log Analytics query.
type LogJSONQuery struct {
	AzureLogAnalytics dataquery.AzureLogsQuery `json:"azureLogAnalytics"`
}

type TracesJSONQuery struct {
	AzureTraces dataquery.AzureTracesQuery `json:"azureTraces"`
}

// MetricChartDefinition is the JSON model for a metrics chart definition
type MetricChartDefinition struct {
	ResourceMetadata    map[string]string   `json:"resourceMetadata"`
	Name                string              `json:"name"`
	AggregationType     int                 `json:"aggregationType"`
	Namespace           string              `json:"namespace"`
	MetricVisualization MetricVisualization `json:"metricVisualization"`
}

// MetricVisualization is the JSON model for the visualization field of a
// metricChartDefinition
type MetricVisualization struct {
	DisplayName         string `json:"displayName"`
	ResourceDisplayName string `json:"resourceDisplayName"`
}

type ServiceProxy interface {
	Do(rw http.ResponseWriter, req *http.Request, cli *http.Client) http.ResponseWriter
}

type LogAnalyticsWorkspaceFeatures struct {
	EnableLogAccessUsingOnlyResourcePermissions bool `json:"enableLogAccessUsingOnlyResourcePermissions"`
	Legacy                                      int  `json:"legacy"`
	SearchVersion                               int  `json:"searchVersion"`
}

type LogAnalyticsWorkspaceProperties struct {
	CreatedDate string                        `json:"createdDate"`
	CustomerId  string                        `json:"customerId"`
	Features    LogAnalyticsWorkspaceFeatures `json:"features"`
}

type LogAnalyticsWorkspaceResponse struct {
	Id                              string                          `json:"id"`
	Location                        string                          `json:"location"`
	Name                            string                          `json:"name"`
	Properties                      LogAnalyticsWorkspaceProperties `json:"properties"`
	ProvisioningState               string                          `json:"provisioningState"`
	PublicNetworkAccessForIngestion string                          `json:"publicNetworkAccessForIngestion"`
	PublicNetworkAccessForQuery     string                          `json:"publicNetworkAccessForQuery"`
	RetentionInDays                 int                             `json:"retentionInDays"`
}

type SubscriptionsResponse struct {
	ID             string `json:"id"`
	SubscriptionID string `json:"subscriptionId"`
	TenantID       string `json:"tenantId"`
	DisplayName    string `json:"displayName"`
}

var ErrorAzureHealthCheck = errors.New("health check failed")

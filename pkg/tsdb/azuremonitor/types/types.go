package types

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
)

const (
	TimeSeries = "time_series"
)

var (
	LegendKeyFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

type AzRoute struct {
	URL     string
	Scopes  []string
	Headers map[string]string
}

type AzureMonitorSettings struct {
	SubscriptionId               string `json:"subscriptionId"`
	LogAnalyticsDefaultWorkspace string `json:"logAnalyticsDefaultWorkspace"`
	AppInsightsAppId             string `json:"appInsightsAppId"`
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
}

// AzureMonitorQuery is the query for all the services as they have similar queries
// with a url, a querystring and an alias field
type AzureMonitorQuery struct {
	URL           string
	UrlComponents map[string]string
	Target        string
	Params        url.Values
	RefID         string
	Alias         string
	TimeRange     backend.TimeRange
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

// AzureMonitorJSONQuery is the frontend JSON query model for an Azure Monitor query.
type AzureMonitorJSONQuery struct {
	AzureMonitor struct {
		Aggregation         string  `json:"aggregation"`
		Alias               string  `json:"alias"`
		AllowedTimeGrainsMs []int64 `json:"allowedTimeGrainsMs"`
		Dimension           string  `json:"dimension"`       // old model
		DimensionFilter     string  `json:"dimensionFilter"` // old model
		Format              string  `json:"format"`
		MetricDefinition    string  `json:"metricDefinition"`
		MetricName          string  `json:"metricName"`
		MetricNamespace     string  `json:"metricNamespace"`
		ResourceGroup       string  `json:"resourceGroup"`
		ResourceName        string  `json:"resourceName"`
		TimeGrain           string  `json:"timeGrain"`
		Top                 string  `json:"top"`

		DimensionFilters []AzureMonitorDimensionFilter `json:"dimensionFilters"` // new model
	} `json:"azureMonitor"`
	Subscription string `json:"subscription"`
}

// AzureMonitorDimensionFilter is the model for the frontend sent for azureMonitor metric
// queries like "BlobType", "eq", "*"
type AzureMonitorDimensionFilter struct {
	Dimension string `json:"dimension"`
	Operator  string `json:"operator"`
	Filter    string `json:"filter"`
}

func (a AzureMonitorDimensionFilter) String() string {
	filter := "*"
	if a.Filter != "" {
		filter = a.Filter
	}
	return fmt.Sprintf("%v %v '%v'", a.Dimension, a.Operator, filter)
}

// LogJSONQuery is the frontend JSON query model for an Azure Log Analytics query.
type LogJSONQuery struct {
	AzureLogAnalytics struct {
		Query        string `json:"query"`
		ResultFormat string `json:"resultFormat"`
		Resource     string `json:"resource"`

		// Deprecated: Queries should be migrated to use Resource instead
		Workspace string `json:"workspace"`
	} `json:"azureLogAnalytics"`
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

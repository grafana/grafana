package azuremonitor

import (
	"net/url"
	"time"
)

// AzureMonitorQuery is the query for all the services as they have similar queries
// with a url, a querystring and an alias field
type AzureMonitorQuery struct {
	URL           string
	UrlComponents map[string]string
	Target        string
	Params        url.Values
	RefID         string
	Alias         string
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
				Average   float64   `json:"average,omitempty"`
				Total     float64   `json:"total,omitempty"`
				Count     float64   `json:"count,omitempty"`
				Maximum   float64   `json:"maximum,omitempty"`
				Minimum   float64   `json:"minimum,omitempty"`
			} `json:"data"`
		} `json:"timeseries"`
	} `json:"value"`
	Namespace      string `json:"namespace"`
	Resourceregion string `json:"resourceregion"`
}

//ApplicationInsightsQueryResponse is the json response from the Application Insights API
type ApplicationInsightsQueryResponse struct {
	Tables []struct {
		Name    string `json:"name"`
		Columns []struct {
			Name string `json:"name"`
			Type string `json:"type"`
		} `json:"columns"`
		Rows [][]interface{} `json:"rows"`
	} `json:"tables"`
}

// AzureLogAnalyticsResponse is the json response object from the Azure Log Analytics API.
type AzureLogAnalyticsResponse struct {
	Tables []AzureLogAnalyticsTable `json:"tables"`
}

//AzureLogAnalyticsTable is the table format for Log Analytics responses
type AzureLogAnalyticsTable struct {
	Name    string `json:"name"`
	Columns []struct {
		Name string `json:"name"`
		Type string `json:"type"`
	} `json:"columns"`
	Rows [][]interface{} `json:"rows"`
}

type metadata struct {
	Columns      []column `json:"columns"`
	Subscription string   `json:"subscription"`
	Workspace    string   `json:"workspace"`
	Query        string   `json:"query"`
	EncodedQuery string   `json:"encodedQuery"`
}

type column struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// azureMonitorJSONQuery is the frontend JSON query model for an Azure Monitor query.
type azureMonitorJSONQuery struct {
	AzureMonitor struct {
		Aggregation         string  `json:"aggregation"`
		Alias               string  `json:"alias"`
		AllowedTimeGrainsMs []int64 `json:"allowedTimeGrainsMs"`
		Dimension           string  `json:"dimension"`
		DimensionFilter     string  `json:"dimensionFilter"`
		Format              string  `json:"format"`
		MetricDefinition    string  `json:"metricDefinition"`
		MetricName          string  `json:"metricName"`
		MetricNamespace     string  `json:"metricNamespace"`
		ResourceGroup       string  `json:"resourceGroup"`
		ResourceName        string  `json:"resourceName"`
		TimeGrain           string  `json:"timeGrain"`
		Top                 string  `json:"top"`
	} `json:"azureMonitor"`
	Subscription string `json:"subscription"`
}

// insightsJSONQuery is the frontend JSON query model for an Azure Application Insights query.
type insightsJSONQuery struct {
	AppInsights struct {
		Aggregation         string  `json:"aggregation"`
		Alias               string  `json:"alias"`
		AllowedTimeGrainsMs []int64 `json:"allowedTimeGrainsMs"`
		Dimension           string  `json:"dimension"`
		DimensionFilter     string  `json:"dimensionFilter"`
		MetricName          string  `json:"metricName"`
		RawQuery            *bool   `json:"rawQuery"`
		RawQueryString      string  `json:"rawQueryString"`
		TimeGrain           string  `json:"timeGrain"`
		TimeColumn          string  `json:"timeColumn"`
		ValueColumn         string  `json:"valueColumn"`
		SegmentColumn       string  `json:"segmentColumn"`
	} `json:"appInsights"`
	Raw *bool `json:"raw"`
}

// logJSONQuery is the frontend JSON query model for an Azure Log Analytics query.
type logJSONQuery struct {
	AzureLogAnalytics struct {
		Query        string `json:"query"`
		ResultFormat string `json:"resultFormat"`
		Workspace    string `json:"workspace"`
	} `json:"azureLogAnalytics"`
}

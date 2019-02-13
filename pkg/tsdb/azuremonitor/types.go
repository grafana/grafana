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

// ApplicationInsightsResponse is the json response from the Application Insights API
type ApplicationInsightsResponse struct {
	Tables []struct {
		TableName string `json:"TableName"`
		Columns   []struct {
			ColumnName string `json:"ColumnName"`
			DataType   string `json:"DataType"`
			ColumnType string `json:"ColumnType"`
		} `json:"Columns"`
		Rows [][]interface{} `json:"Rows"`
	} `json:"Tables"`
}

// AzureLogAnalyticsResponse is the json response object from the Azure Log Analytics API.
type AzureLogAnalyticsResponse struct {
	Tables []struct {
		Name    string `json:"name"`
		Columns []struct {
			Name string `json:"name"`
			Type string `json:"type"`
		} `json:"columns"`
		Rows [][]interface{} `json:"rows"`
	} `json:"tables"`
}

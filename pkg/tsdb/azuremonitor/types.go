package azuremonitor

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
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

// azureMonitorJSONQuery is the frontend JSON query model for an Azure Monitor query.
type azureMonitorJSONQuery struct {
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

		DimensionsFilters []azureMonitorDimensionFilter `json:"dimensionsFilters"` // new model
	} `json:"azureMonitor"`
	Subscription string `json:"subscription"`
}

// azureMonitorDimensionFilter is the model for the frontend sent for azureMonitor metric
// queries like "BlobType", "eq", "*"
type azureMonitorDimensionFilter struct {
	Dimension string `json:"dimension"`
	Operator  string `json:"operator"`
	Filter    string `json:"filter"`
}

func (a azureMonitorDimensionFilter) String() string {
	return fmt.Sprintf("%v %v '%v'", a.Dimension, a.Operator, a.Filter)
}

// insightsJSONQuery is the frontend JSON query model for an Azure Application Insights query.
type insightsJSONQuery struct {
	AppInsights struct {
		Aggregation         string             `json:"aggregation"`
		Alias               string             `json:"alias"`
		AllowedTimeGrainsMs []int64            `json:"allowedTimeGrainsMs"`
		Dimensions          InsightsDimensions `json:"dimension"`
		DimensionFilter     string             `json:"dimensionFilter"`
		MetricName          string             `json:"metricName"`
		TimeGrain           string             `json:"timeGrain"`
	} `json:"appInsights"`
	Raw *bool `json:"raw"`
}

type insightsAnalyticsJSONQuery struct {
	InsightsAnalytics struct {
		Query        string `json:"query"`
		ResultFormat string `json:"resultFormat"`
	} `json:"insightsAnalytics"`
}

// logJSONQuery is the frontend JSON query model for an Azure Log Analytics query.
type logJSONQuery struct {
	AzureLogAnalytics struct {
		Query        string `json:"query"`
		ResultFormat string `json:"resultFormat"`
		Workspace    string `json:"workspace"`
	} `json:"azureLogAnalytics"`
}

// InsightsDimensions will unmarshal from a JSON string, or an array of strings,
// into a string array. This exists to support an older query format which is updated
// when a user saves the query or it is sent from the front end, but may not be when
// alerting fetches the model.
type InsightsDimensions []string

// UnmarshalJSON fulfills the json.Unmarshaler interface type.
func (s *InsightsDimensions) UnmarshalJSON(data []byte) error {
	*s = InsightsDimensions{}
	if string(data) == "null" || string(data) == "" {
		return nil
	}
	if strings.ToLower(string(data)) == `"none"` {
		return nil
	}
	if data[0] == '[' {
		var sa []string
		err := json.Unmarshal(data, &sa)
		if err != nil {
			return err
		}
		*s = InsightsDimensions(sa)
		return nil
	}

	var str string
	err := json.Unmarshal(data, &str)
	if err != nil {
		return fmt.Errorf("could not parse %q as string or array: %w", string(data), err)

	}
	if str != "" {
		*s = InsightsDimensions{str}
		return nil
	}
	return nil
}

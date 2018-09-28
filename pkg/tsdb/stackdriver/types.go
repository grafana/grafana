package stackdriver

import (
	"net/url"
	"time"
)

// StackdriverQuery is the query that Grafana sends from the frontend
type StackdriverQuery struct {
	Target   string
	Params   url.Values
	RefID    string
	GroupBys []string
	AliasBy  string
}

// StackdriverResponse is the data returned from the external Google Stackdriver API
type StackdriverResponse struct {
	TimeSeries []struct {
		Metric struct {
			Labels map[string]string `json:"labels"`
			Type   string            `json:"type"`
		} `json:"metric"`
		Resource struct {
			Type   string            `json:"type"`
			Labels map[string]string `json:"labels"`
		} `json:"resource"`
		MetricKind string `json:"metricKind"`
		ValueType  string `json:"valueType"`
		Points     []struct {
			Interval struct {
				StartTime time.Time `json:"startTime"`
				EndTime   time.Time `json:"endTime"`
			} `json:"interval"`
			Value struct {
				DoubleValue float64 `json:"doubleValue"`
				StringValue string  `json:"stringValue"`
				BoolValue   bool    `json:"boolValue"`
				IntValue    string  `json:"int64Value"`
			} `json:"value"`
		} `json:"points"`
	} `json:"timeSeries"`
}

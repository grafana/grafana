package stackdriver

import (
	"net/url"
	"time"
)

type StackdriverQuery struct {
	Target string
	Params url.Values
	RefID  string
}

type StackDriverResponse struct {
	TimeSeries []struct {
		Metric struct {
			Labels struct {
				InstanceName string `json:"instance_name"`
			} `json:"labels"`
			Type string `json:"type"`
		} `json:"metric"`
		Resource struct {
			Type   string `json:"type"`
			Labels struct {
				InstanceID string `json:"instance_id"`
				Zone       string `json:"zone"`
				ProjectID  string `json:"project_id"`
			} `json:"labels"`
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
			} `json:"value"`
		} `json:"points"`
	} `json:"timeSeries"`
}

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
			} `json:"value"`
		} `json:"points"`
	} `json:"timeSeries"`
}

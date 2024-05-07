package models

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	QueryMetricValue     = "GetMetricValue"
	QueryMetricHistory   = "GetMetricHistory"
	QueryMetricAggregate = "GetMetricAggregate"
	QueryMetricTable     = "GetMetricTable"
	QueryDimensionKeys   = "ListDimensionKeys"
	QueryDimensionValues = "ListDimensionValues"
	QueryMetrics         = "ListMetrics"
	QueryDatasets        = "ListDatasets"
)

type Metric struct {
	MetricId string `json:"metricId"`
}

type Dimension struct {
	Key      string   `json:"key"`
	Value    []string `json:"value"`
	Operator string   `json:"operator"`
}

type DisplayName struct {
	Field string `json:"field"`
	Value string `json:"value"`
}

type MetricBaseQuery struct {
	Dataset      string        `json:"dataset"`
	Metrics      []Metric      `json:"metrics"`
	Dimensions   []Dimension   `json:"dimensions,omitempty"`
	MaxItems     int32         `json:"maxItems,omitempty"`
	DisplayNames []DisplayName `json:"displayNames,omitempty"`

	Interval  time.Duration     `json:"-"`
	TimeRange backend.TimeRange `json:"-"`
	QueryType string            `json:"-"`
}

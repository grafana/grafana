package elasticsearch

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

// Query represents the time series query model of the datasource
type Query struct {
	TimeField  string       `json:"timeField"`
	RawQuery   string       `json:"query"`
	BucketAggs []*BucketAgg `json:"bucketAggs"`
	Metrics    []*MetricAgg `json:"metrics"`
	Alias      string       `json:"alias"`
	Interval   string
	RefID      string
}

// BucketAgg represents a bucket aggregation of the time series query model of the datasource
type BucketAgg struct {
	Field    string           `json:"field"`
	ID       string           `json:"id"`
	Settings *simplejson.Json `json:"settings"`
	Type     string           `jsons:"type"`
}

// MetricAgg represents a metric aggregation of the time series query model of the datasource
type MetricAgg struct {
	Field             string            `json:"field"`
	Hide              bool              `json:"hide"`
	ID                string            `json:"id"`
	PipelineAggregate string            `json:"pipelineAgg"`
	PipelineVariables map[string]string `json:"pipelineVariables"`
	Settings          *simplejson.Json  `json:"settings"`
	Meta              *simplejson.Json  `json:"meta"`
	Type              string            `json:"type"`
}

var metricAggType = map[string]string{
	"count":          "Count",
	"avg":            "Average",
	"sum":            "Sum",
	"max":            "Max",
	"min":            "Min",
	"extended_stats": "Extended Stats",
	"percentiles":    "Percentiles",
	"cardinality":    "Unique Count",
	"moving_avg":     "Moving Average",
	"cumulative_sum": "Cumulative Sum",
	"derivative":     "Derivative",
	"bucket_script":  "Bucket Script",
	"raw_document":   "Raw Document",
}

var extendedStats = map[string]string{
	"avg":                        "Avg",
	"min":                        "Min",
	"max":                        "Max",
	"sum":                        "Sum",
	"count":                      "Count",
	"std_deviation":              "Std Dev",
	"std_deviation_bounds_upper": "Std Dev Upper",
	"std_deviation_bounds_lower": "Std Dev Lower",
}

var pipelineAggType = map[string]string{
	"moving_avg":     "moving_avg",
	"cumulative_sum": "cumulative_sum",
	"derivative":     "derivative",
	"bucket_script":  "bucket_script",
}

var pipelineAggWithMultipleBucketPathsType = map[string]string{
	"bucket_script": "bucket_script",
}

func isPipelineAgg(metricType string) bool {
	if _, ok := pipelineAggType[metricType]; ok {
		return true
	}
	return false
}

func isPipelineAggWithMultipleBucketPaths(metricType string) bool {
	if _, ok := pipelineAggWithMultipleBucketPathsType[metricType]; ok {
		return true
	}
	return false
}

func describeMetric(metricType, field string) string {
	text := metricAggType[metricType]
	if metricType == countType {
		return text
	}
	return text + " " + field
}

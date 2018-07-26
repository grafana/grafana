package elasticsearch

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

type queryEndpoint interface {
	execute() (*tsdb.Response, error)
}

type responseTransformer interface {
	transform() (*tsdb.Response, error)
}

type timeSeriesQueryModel struct {
	timeField   string
	queryString string
	bucketAggs  []*bucketAggregation
	metrics     []*metricAggregation
	alias       string
	interval    string
	refID       string
}

type bucketAggregation struct {
	field    string
	id       string
	settings *simplejson.Json
	aggType  string
}

type metricAggregation struct {
	field             string
	hide              bool
	id                string
	pipelineAggregate string
	pipelineVariables map[string]string `json:"pipelineVariables"`
	settings          *simplejson.Json
	meta              *simplejson.Json
	aggType           string
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
	"moving_fn":      "Moving Function",
	"cumulative_sum": "Cumulative Sum",
	"derivative":     "Derivative",
	"serial_diff":    "Serial Difference",
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
	"moving_fn":      "moving_fn",
	"cumulative_sum": "cumulative_sum",
	"derivative":     "derivative",
	"serial_diff":    "serial_diff",
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

type annotationQueryModel struct {
	timeField   string
	tagsField   string
	textField   string
	titleField  string
	queryString string
	refID       string
}

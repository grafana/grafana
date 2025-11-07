package elasticsearch

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/kinds/dataquery"
)

// Query represents the time series query model of the datasource
type Query struct {
	RawQuery      string             `json:"query"`
	BucketAggs    []*BucketAgg       `json:"bucketAggs"`
	Metrics       []*MetricAgg       `json:"metrics"`
	Alias         string             `json:"alias"`
	Interval      time.Duration
	IntervalMs    int64
	RefID         string
	MaxDataPoints int64
	TimeRange     backend.TimeRange
	RawDSLQuery   dataquery.RawQuery `json:"rawDslQuery"`
}

// UnmarshalJSON custom unmarshaller to handle both old string format and new struct format
func (q *Query) UnmarshalJSON(data []byte) error {
	// Create a temporary struct with all fields explicitly defined
	aux := &struct {
		RawQuery      string            `json:"query"`
		BucketAggs    []*BucketAgg      `json:"bucketAggs"`
		Metrics       []*MetricAgg      `json:"metrics"`
		Alias         string            `json:"alias"`
		Interval      time.Duration     `json:"interval"`
		IntervalMs    int64             `json:"intervalMs"`
		RefID         string            `json:"refId"`
		MaxDataPoints int64             `json:"maxDataPoints"`
		TimeRange     backend.TimeRange `json:"timeRange"`
	}{}

	// Unmarshal all standard fields
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}

	// Copy fields to query
	q.RawQuery = aux.RawQuery
	q.BucketAggs = aux.BucketAggs
	q.Metrics = aux.Metrics
	q.Alias = aux.Alias
	q.Interval = aux.Interval
	q.IntervalMs = aux.IntervalMs
	q.RefID = aux.RefID
	q.MaxDataPoints = aux.MaxDataPoints
	q.TimeRange = aux.TimeRange

	// Handle rawDslQuery field specially - it can be either a string or an object
	var rawData map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawData); err != nil {
		return err
	}

	if rawDslQueryData, ok := rawData["rawDslQuery"]; ok && len(rawDslQueryData) > 0 {
		// Try to unmarshal as string first (old format)
		var rawDslQueryString string
		if err := json.Unmarshal(rawDslQueryData, &rawDslQueryString); err == nil {
			// It's a string - convert to RawQuery struct
			q.RawDSLQuery = dataquery.RawQuery{
				Query: &rawDslQueryString,
			}
		} else {
			// Try as object (new format)
			var rawDslQueryStruct dataquery.RawQuery
			if err := json.Unmarshal(rawDslQueryData, &rawDslQueryStruct); err == nil {
				q.RawDSLQuery = rawDslQueryStruct
			}
		}
	}

	return nil
}

// BucketAgg represents a bucket aggregation of the time series query model of the datasource
type BucketAgg struct {
	Field    string           `json:"field"`
	ID       string           `json:"id"`
	Settings *simplejson.Json `json:"settings"`
	Type     string           `json:"type"`
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
	"top_metrics":    "Top Metrics",
	"cardinality":    "Unique Count",
	"moving_avg":     "Moving Average",
	"moving_fn":      "Moving Function",
	"cumulative_sum": "Cumulative Sum",
	"derivative":     "Derivative",
	"serial_diff":    "Serial Difference",
	"bucket_script":  "Bucket Script",
	"raw_document":   "Raw Document",
	"raw_data":       "Raw Data",
	"rate":           "Rate",
	"logs":           "Logs",
	"raw_dsl":        "Raw DSL",
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

var scriptableAggType = map[string]string{
	"avg":            "avg",
	"sum":            "sum",
	"max":            "max",
	"min":            "min",
	"extended_stats": "extended_stats",
	"percentiles":    "percentiles",
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

func isMetricAggregationWithInlineScriptSupport(metricType string) bool {
	if _, ok := scriptableAggType[metricType]; ok {
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

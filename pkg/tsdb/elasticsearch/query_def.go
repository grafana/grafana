package elasticsearch

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
	"derivative":     "Derivative",
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

var pipelineOptions = map[string]string{
	"moving_avg": "moving_avg",
	"derivative": "derivative",
}

func isPipelineAgg(metricType string) bool {
	if _, ok := pipelineOptions[metricType]; ok {
		return true
	}
	return false
}

func describeMetric(metricType, field string) string {
	text := metricAggType[metricType]
	return text + " " + field
}

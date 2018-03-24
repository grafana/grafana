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

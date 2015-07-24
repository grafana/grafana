// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// DateHistogramAggregation is a multi-bucket aggregation similar to the
// histogram except it can only be applied on date values.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html
type DateHistogramAggregation struct {
	field           string
	script          string
	scriptFile      string
	lang            string
	params          map[string]interface{}
	subAggregations map[string]Aggregation

	interval                   string
	order                      string
	orderAsc                   bool
	minDocCount                *int64
	extendedBoundsMin          interface{}
	extendedBoundsMax          interface{}
	preZone                    string
	postZone                   string
	preZoneAdjustLargeInterval *bool
	format                     string
	preOffset                  int64
	postOffset                 int64
	factor                     *float32
}

func NewDateHistogramAggregation() DateHistogramAggregation {
	a := DateHistogramAggregation{
		params:          make(map[string]interface{}),
		subAggregations: make(map[string]Aggregation),
	}
	return a
}

func (a DateHistogramAggregation) Field(field string) DateHistogramAggregation {
	a.field = field
	return a
}

func (a DateHistogramAggregation) Script(script string) DateHistogramAggregation {
	a.script = script
	return a
}

func (a DateHistogramAggregation) ScriptFile(scriptFile string) DateHistogramAggregation {
	a.scriptFile = scriptFile
	return a
}

func (a DateHistogramAggregation) Lang(lang string) DateHistogramAggregation {
	a.lang = lang
	return a
}

func (a DateHistogramAggregation) Param(name string, value interface{}) DateHistogramAggregation {
	a.params[name] = value
	return a
}

func (a DateHistogramAggregation) SubAggregation(name string, subAggregation Aggregation) DateHistogramAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Allowed values are: "year", "quarter", "month", "week", "day",
// "hour", "minute". It also supports time settings like "1.5h"
// (up to "w" for weeks).
func (a DateHistogramAggregation) Interval(interval string) DateHistogramAggregation {
	a.interval = interval
	return a
}

// Order specifies the sort order. Valid values for order are:
// "_key", "_count", a sub-aggregation name, or a sub-aggregation name
// with a metric.
func (a DateHistogramAggregation) Order(order string, asc bool) DateHistogramAggregation {
	a.order = order
	a.orderAsc = asc
	return a
}

func (a DateHistogramAggregation) OrderByCount(asc bool) DateHistogramAggregation {
	// "order" : { "_count" : "asc" }
	a.order = "_count"
	a.orderAsc = asc
	return a
}

func (a DateHistogramAggregation) OrderByCountAsc() DateHistogramAggregation {
	return a.OrderByCount(true)
}

func (a DateHistogramAggregation) OrderByCountDesc() DateHistogramAggregation {
	return a.OrderByCount(false)
}

func (a DateHistogramAggregation) OrderByKey(asc bool) DateHistogramAggregation {
	// "order" : { "_key" : "asc" }
	a.order = "_key"
	a.orderAsc = asc
	return a
}

func (a DateHistogramAggregation) OrderByKeyAsc() DateHistogramAggregation {
	return a.OrderByKey(true)
}

func (a DateHistogramAggregation) OrderByKeyDesc() DateHistogramAggregation {
	return a.OrderByKey(false)
}

// OrderByAggregation creates a bucket ordering strategy which sorts buckets
// based on a single-valued calc get.
func (a DateHistogramAggregation) OrderByAggregation(aggName string, asc bool) DateHistogramAggregation {
	// {
	//     "aggs" : {
	//         "genders" : {
	//             "terms" : {
	//                 "field" : "gender",
	//                 "order" : { "avg_height" : "desc" }
	//             },
	//             "aggs" : {
	//                 "avg_height" : { "avg" : { "field" : "height" } }
	//             }
	//         }
	//     }
	// }
	a.order = aggName
	a.orderAsc = asc
	return a
}

// OrderByAggregationAndMetric creates a bucket ordering strategy which
// sorts buckets based on a multi-valued calc get.
func (a DateHistogramAggregation) OrderByAggregationAndMetric(aggName, metric string, asc bool) DateHistogramAggregation {
	// {
	//     "aggs" : {
	//         "genders" : {
	//             "terms" : {
	//                 "field" : "gender",
	//                 "order" : { "height_stats.avg" : "desc" }
	//             },
	//             "aggs" : {
	//                 "height_stats" : { "stats" : { "field" : "height" } }
	//             }
	//         }
	//     }
	// }
	a.order = aggName + "." + metric
	a.orderAsc = asc
	return a
}

func (a DateHistogramAggregation) MinDocCount(minDocCount int64) DateHistogramAggregation {
	a.minDocCount = &minDocCount
	return a
}

func (a DateHistogramAggregation) PreZone(preZone string) DateHistogramAggregation {
	a.preZone = preZone
	return a
}

func (a DateHistogramAggregation) PostZone(postZone string) DateHistogramAggregation {
	a.postZone = postZone
	return a
}

func (a DateHistogramAggregation) PreZoneAdjustLargeInterval(preZoneAdjustLargeInterval bool) DateHistogramAggregation {
	a.preZoneAdjustLargeInterval = &preZoneAdjustLargeInterval
	return a
}

func (a DateHistogramAggregation) PreOffset(preOffset int64) DateHistogramAggregation {
	a.preOffset = preOffset
	return a
}

func (a DateHistogramAggregation) PostOffset(postOffset int64) DateHistogramAggregation {
	a.postOffset = postOffset
	return a
}

func (a DateHistogramAggregation) Factor(factor float32) DateHistogramAggregation {
	a.factor = &factor
	return a
}

func (a DateHistogramAggregation) Format(format string) DateHistogramAggregation {
	a.format = format
	return a
}

// ExtendedBoundsMin accepts int, int64, string, or time.Time values.
func (a DateHistogramAggregation) ExtendedBoundsMin(min interface{}) DateHistogramAggregation {
	a.extendedBoundsMin = min
	return a
}

// ExtendedBoundsMax accepts int, int64, string, or time.Time values.
func (a DateHistogramAggregation) ExtendedBoundsMax(max interface{}) DateHistogramAggregation {
	a.extendedBoundsMax = max
	return a
}

func (a DateHistogramAggregation) Source() interface{} {
	// Example:
	// {
	//     "aggs" : {
	//         "articles_over_time" : {
	//             "date_histogram" : {
	//                 "field" : "date",
	//                 "interval" : "month"
	//             }
	//         }
	//     }
	// }
	//
	// This method returns only the { "date_histogram" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["date_histogram"] = opts

	// ValuesSourceAggregationBuilder
	if a.field != "" {
		opts["field"] = a.field
	}
	if a.script != "" {
		opts["script"] = a.script
	}
	if a.scriptFile != "" {
		opts["script_file"] = a.scriptFile
	}
	if a.lang != "" {
		opts["lang"] = a.lang
	}
	if len(a.params) > 0 {
		opts["params"] = a.params
	}

	opts["interval"] = a.interval
	if a.minDocCount != nil {
		opts["min_doc_count"] = *a.minDocCount
	}
	if a.order != "" {
		o := make(map[string]interface{})
		if a.orderAsc {
			o[a.order] = "asc"
		} else {
			o[a.order] = "desc"
		}
		opts["order"] = o
	}
	if a.preZone != "" {
		opts["pre_zone"] = a.preZone
	}
	if a.postZone != "" {
		opts["post_zone"] = a.postZone
	}
	if a.preZoneAdjustLargeInterval != nil {
		opts["pre_zone_adjust_large_interval"] = *a.preZoneAdjustLargeInterval
	}
	if a.preOffset != 0 {
		opts["pre_offset"] = a.preOffset
	}
	if a.postOffset != 0 {
		opts["post_offset"] = a.postOffset
	}
	if a.factor != nil {
		opts["factor"] = *a.factor
	}
	if a.format != "" {
		opts["format"] = a.format
	}
	if a.extendedBoundsMin != nil || a.extendedBoundsMax != nil {
		bounds := make(map[string]interface{})
		if a.extendedBoundsMin != nil {
			bounds["min"] = a.extendedBoundsMin
		}
		if a.extendedBoundsMax != nil {
			bounds["max"] = a.extendedBoundsMax
		}
		opts["extended_bounds"] = bounds
	}

	// AggregationBuilder (SubAggregations)
	if len(a.subAggregations) > 0 {
		aggsMap := make(map[string]interface{})
		source["aggregations"] = aggsMap
		for name, aggregate := range a.subAggregations {
			aggsMap[name] = aggregate.Source()
		}
	}

	return source
}

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// HistogramAggregation is a multi-bucket values source based aggregation
// that can be applied on numeric values extracted from the documents.
// It dynamically builds fixed size (a.k.a. interval) buckets over the
// values.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-histogram-aggregation.html
type HistogramAggregation struct {
	field           string
	script          string
	scriptFile      string
	lang            string
	params          map[string]interface{}
	subAggregations map[string]Aggregation

	interval          int64
	order             string
	orderAsc          bool
	minDocCount       *int64
	extendedBoundsMin *int64
	extendedBoundsMax *int64
}

func NewHistogramAggregation() HistogramAggregation {
	a := HistogramAggregation{
		params:          make(map[string]interface{}),
		subAggregations: make(map[string]Aggregation),
	}
	return a
}

func (a HistogramAggregation) Field(field string) HistogramAggregation {
	a.field = field
	return a
}

func (a HistogramAggregation) Script(script string) HistogramAggregation {
	a.script = script
	return a
}

func (a HistogramAggregation) ScriptFile(scriptFile string) HistogramAggregation {
	a.scriptFile = scriptFile
	return a
}

func (a HistogramAggregation) Lang(lang string) HistogramAggregation {
	a.lang = lang
	return a
}

func (a HistogramAggregation) Param(name string, value interface{}) HistogramAggregation {
	a.params[name] = value
	return a
}

func (a HistogramAggregation) SubAggregation(name string, subAggregation Aggregation) HistogramAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a HistogramAggregation) Interval(interval int64) HistogramAggregation {
	a.interval = interval
	return a
}

// Order specifies the sort order. Valid values for order are:
// "_key", "_count", a sub-aggregation name, or a sub-aggregation name
// with a metric.
func (a HistogramAggregation) Order(order string, asc bool) HistogramAggregation {
	a.order = order
	a.orderAsc = asc
	return a
}

func (a HistogramAggregation) OrderByCount(asc bool) HistogramAggregation {
	// "order" : { "_count" : "asc" }
	a.order = "_count"
	a.orderAsc = asc
	return a
}

func (a HistogramAggregation) OrderByCountAsc() HistogramAggregation {
	return a.OrderByCount(true)
}

func (a HistogramAggregation) OrderByCountDesc() HistogramAggregation {
	return a.OrderByCount(false)
}

func (a HistogramAggregation) OrderByKey(asc bool) HistogramAggregation {
	// "order" : { "_key" : "asc" }
	a.order = "_key"
	a.orderAsc = asc
	return a
}

func (a HistogramAggregation) OrderByKeyAsc() HistogramAggregation {
	return a.OrderByKey(true)
}

func (a HistogramAggregation) OrderByKeyDesc() HistogramAggregation {
	return a.OrderByKey(false)
}

// OrderByAggregation creates a bucket ordering strategy which sorts buckets
// based on a single-valued calc get.
func (a HistogramAggregation) OrderByAggregation(aggName string, asc bool) HistogramAggregation {
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
func (a HistogramAggregation) OrderByAggregationAndMetric(aggName, metric string, asc bool) HistogramAggregation {
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

func (a HistogramAggregation) MinDocCount(minDocCount int64) HistogramAggregation {
	a.minDocCount = &minDocCount
	return a
}

func (a HistogramAggregation) ExtendedBoundsMin(min int64) HistogramAggregation {
	a.extendedBoundsMin = &min
	return a
}

func (a HistogramAggregation) ExtendedBoundsMax(max int64) HistogramAggregation {
	a.extendedBoundsMax = &max
	return a
}

func (a HistogramAggregation) Source() interface{} {
	// Example:
	// {
	//     "aggs" : {
	//         "prices" : {
	//             "histogram" : {
	//                 "field" : "price",
	//                 "interval" : 50
	//             }
	//         }
	//     }
	// }
	//
	// This method returns only the { "histogram" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["histogram"] = opts

	// ValuesSourceAggregationBuilder
	if a.field != "" {
		opts["field"] = a.field
	}
	if a.script != "" {
		opts["script"] = a.script
	}
	if a.lang != "" {
		opts["lang"] = a.lang
	}
	if len(a.params) > 0 {
		opts["params"] = a.params
	}

	opts["interval"] = a.interval
	if a.order != "" {
		o := make(map[string]interface{})
		if a.orderAsc {
			o[a.order] = "asc"
		} else {
			o[a.order] = "desc"
		}
		opts["order"] = o
	}
	if a.minDocCount != nil {
		opts["min_doc_count"] = *a.minDocCount
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

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// FiltersAggregation defines a multi bucket aggregations where each bucket
// is associated with a filter. Each bucket will collect all documents that
// match its associated filter.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-filters-aggregation.html
type FiltersAggregation struct {
	filters         []Filter
	subAggregations map[string]Aggregation
}

func NewFiltersAggregation() FiltersAggregation {
	return FiltersAggregation{
		filters:         make([]Filter, 0),
		subAggregations: make(map[string]Aggregation),
	}
}

func (a FiltersAggregation) Filter(filter Filter) FiltersAggregation {
	a.filters = append(a.filters, filter)
	return a
}

func (a FiltersAggregation) Filters(filters ...Filter) FiltersAggregation {
	if len(filters) > 0 {
		a.filters = append(a.filters, filters...)
	}
	return a
}

func (a FiltersAggregation) SubAggregation(name string, subAggregation Aggregation) FiltersAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a FiltersAggregation) Source() interface{} {
	// Example:
	//	{
	//  "aggs" : {
	//    "messages" : {
	//      "filters" : {
	//        "filters" : {
	//          "errors" :   { "term" : { "body" : "error"   }},
	//          "warnings" : { "term" : { "body" : "warning" }}
	//        }
	//      }
	//    }
	//  }
	//	}
	// This method returns only the (outer) { "filters" : {} } part.

	source := make(map[string]interface{})
	filters := make(map[string]interface{})
	source["filters"] = filters

	arr := make([]interface{}, len(a.filters))
	for i, filter := range a.filters {
		arr[i] = filter.Source()
	}
	filters["filters"] = arr

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

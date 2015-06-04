// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// FilterAggregation defines a single bucket of all the documents
// in the current document set context that match a specified filter.
// Often this will be used to narrow down the current aggregation context
// to a specific set of documents.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-filter-aggregation.html
type FilterAggregation struct {
	filter          Filter
	subAggregations map[string]Aggregation
}

func NewFilterAggregation() FilterAggregation {
	a := FilterAggregation{
		subAggregations: make(map[string]Aggregation),
	}
	return a
}

func (a FilterAggregation) SubAggregation(name string, subAggregation Aggregation) FilterAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a FilterAggregation) Filter(filter Filter) FilterAggregation {
	a.filter = filter
	return a
}

func (a FilterAggregation) Source() interface{} {
	// Example:
	//	{
	//    "aggs" : {
	//         "in_stock_products" : {
	//             "filter" : { "range" : { "stock" : { "gt" : 0 } } }
	//         }
	//    }
	//	}
	// This method returns only the { "filter" : {} } part.

	source := make(map[string]interface{})
	source["filter"] = a.filter.Source()

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

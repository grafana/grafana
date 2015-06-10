// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// GlobalAggregation defines a single bucket of all the documents within
// the search execution context. This context is defined by the indices
// and the document types you’re searching on, but is not influenced
// by the search query itself.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-global-aggregation.html
type GlobalAggregation struct {
	subAggregations map[string]Aggregation
}

func NewGlobalAggregation() GlobalAggregation {
	a := GlobalAggregation{
		subAggregations: make(map[string]Aggregation),
	}
	return a
}

func (a GlobalAggregation) SubAggregation(name string, subAggregation Aggregation) GlobalAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a GlobalAggregation) Source() interface{} {
	// Example:
	//	{
	//    "aggs" : {
	//         "all_products" : {
	//             "global" : {},
	//             "aggs" : {
	//                 "avg_price" : { "avg" : { "field" : "price" } }
	//             }
	//         }
	//    }
	//	}
	// This method returns only the { "global" : {} } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["global"] = opts

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

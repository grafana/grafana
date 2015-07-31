// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A limit filter limits the number of documents (per shard) to execute on.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-limit-filter.html
type LimitFilter struct {
	Filter
	limit int
}

func NewLimitFilter(limit int) LimitFilter {
	f := LimitFilter{limit: limit}
	return f
}

func (f LimitFilter) Source() interface{} {
	// {
	//   "limit" : {
	//     "value" : "..."
	//   }
	// }
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["limit"] = params
	params["value"] = f.limit
	return source
}

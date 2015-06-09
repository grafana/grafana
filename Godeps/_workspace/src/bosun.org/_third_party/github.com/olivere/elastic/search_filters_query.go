// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// QueryFilter wraps any query to be used as a filter. It can be placed
// within queries that accept a filter.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-query-filter.html
type QueryFilter struct {
	Filter
	name       string
	query      Query
	cache      *bool
	filterName string
}

func NewQueryFilter(query Query) QueryFilter {
	f := QueryFilter{query: query}
	return f
}

func (f QueryFilter) Name(name string) QueryFilter {
	f.name = name
	return f
}

func (f QueryFilter) Query(query Query) QueryFilter {
	f.query = query
	return f
}

func (f QueryFilter) Cache(cache bool) QueryFilter {
	f.cache = &cache
	return f
}

func (f QueryFilter) FilterName(filterName string) QueryFilter {
	f.filterName = filterName
	return f
}

func (f QueryFilter) Source() interface{} {
	// {
	//   "query" : {
	//     "..." : "..."
	//   }
	// }

	source := make(map[string]interface{})

	if f.filterName == "" && (f.cache == nil || *f.cache == false) {
		source["query"] = f.query.Source()
	} else {
		params := make(map[string]interface{})
		source["fquery"] = params
		params["query"] = f.query.Source()
		if f.filterName != "" {
			params["_name"] = f.filterName
		}
		if f.cache != nil {
			params["_cache"] = *f.cache
		}
	}

	return source
}

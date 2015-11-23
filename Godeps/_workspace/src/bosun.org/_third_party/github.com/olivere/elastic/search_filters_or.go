// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A filter that matches documents using OR boolean operator
// on other queries. Can be placed within queries that accept a filter.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-or-filter.html
type OrFilter struct {
	filters    []Filter
	cache      *bool
	cacheKey   string
	filterName string
}

func NewOrFilter(filters ...Filter) OrFilter {
	f := OrFilter{
		filters: make([]Filter, 0),
	}
	if len(filters) > 0 {
		f.filters = append(f.filters, filters...)
	}
	return f
}

func (f OrFilter) Add(filter Filter) OrFilter {
	f.filters = append(f.filters, filter)
	return f
}

func (f OrFilter) Cache(cache bool) OrFilter {
	f.cache = &cache
	return f
}

func (f OrFilter) CacheKey(cacheKey string) OrFilter {
	f.cacheKey = cacheKey
	return f
}

func (f OrFilter) FilterName(filterName string) OrFilter {
	f.filterName = filterName
	return f
}

func (f OrFilter) Source() interface{} {
	// {
	//   "or" : [
	//      ... filters ...
	//   ]
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["or"] = params

	filters := make([]interface{}, len(f.filters))
	params["filters"] = filters
	for i, filter := range f.filters {
		filters[i] = filter.Source()
	}

	if f.cache != nil {
		params["_cache"] = *f.cache
	}
	if f.cacheKey != "" {
		params["_cache_key"] = f.cacheKey
	}
	if f.filterName != "" {
		params["_name"] = f.filterName
	}
	return source
}

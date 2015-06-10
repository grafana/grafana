// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A filter that matches documents using AND boolean operator
// on other filters. Can be placed within queries that accept a filter.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-and-filter.html
type AndFilter struct {
	filters    []Filter
	cache      *bool
	cacheKey   string
	filterName string
}

func NewAndFilter(filters ...Filter) AndFilter {
	f := AndFilter{
		filters: make([]Filter, 0),
	}
	if len(filters) > 0 {
		f.filters = append(f.filters, filters...)
	}
	return f
}

func (f AndFilter) Add(filter Filter) AndFilter {
	f.filters = append(f.filters, filter)
	return f
}

func (f AndFilter) Cache(cache bool) AndFilter {
	f.cache = &cache
	return f
}

func (f AndFilter) CacheKey(cacheKey string) AndFilter {
	f.cacheKey = cacheKey
	return f
}

func (f AndFilter) FilterName(filterName string) AndFilter {
	f.filterName = filterName
	return f
}

func (f AndFilter) Source() interface{} {
	// {
	//   "and" : [
	//      ... filters ...
	//   ]
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["and"] = params

	filters := make([]interface{}, 0)
	for _, filter := range f.filters {
		filters = append(filters, filter.Source())
	}
	params["filters"] = filters

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

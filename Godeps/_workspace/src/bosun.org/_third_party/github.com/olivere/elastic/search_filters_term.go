// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents that have fields that contain
// a term (not analyzed). For details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/term-filter.html
type TermFilter struct {
	Filter
	name       string
	value      interface{}
	cache      *bool
	cacheKey   string
	filterName string
}

func NewTermFilter(name string, value interface{}) TermFilter {
	f := TermFilter{name: name, value: value}
	return f
}

func (f TermFilter) Cache(cache bool) TermFilter {
	f.cache = &cache
	return f
}

func (f TermFilter) CacheKey(cacheKey string) TermFilter {
	f.cacheKey = cacheKey
	return f
}

func (f TermFilter) FilterName(filterName string) TermFilter {
	f.filterName = filterName
	return f
}

func (f TermFilter) Source() interface{} {
	// {
	//   "term" : {
	//     "..." : "..."
	//   }
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["term"] = params

	params[f.name] = f.value

	if f.filterName != "" {
		params["_name"] = f.filterName
	}

	if f.cache != nil {
		params["_cache"] = *f.cache
	}

	if f.cacheKey != "" {
		params["_cache_key"] = f.cacheKey
	}

	return source
}

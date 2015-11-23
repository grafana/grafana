// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents that have fiels containing terms
// with a specified prefix (not analyzed).
// For details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/prefix-filter.html
type PrefixFilter struct {
	Filter
	name       string
	prefix     string
	cache      *bool
	cacheKey   string
	filterName string
}

func NewPrefixFilter(name string, prefix string) PrefixFilter {
	f := PrefixFilter{name: name, prefix: prefix}
	return f
}

func (f PrefixFilter) Cache(cache bool) PrefixFilter {
	f.cache = &cache
	return f
}

func (f PrefixFilter) CacheKey(cacheKey string) PrefixFilter {
	f.cacheKey = cacheKey
	return f
}

func (f PrefixFilter) FilterName(filterName string) PrefixFilter {
	f.filterName = filterName
	return f
}

func (f PrefixFilter) Source() interface{} {
	// {
	//   "prefix" : {
	//     "..." : "..."
	//   }
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["prefix"] = params

	params[f.name] = f.prefix

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

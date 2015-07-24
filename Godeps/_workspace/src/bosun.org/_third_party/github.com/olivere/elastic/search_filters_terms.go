// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents that have fields that match
// any of the provided terms (not analyzed). For details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/terms-filter/
type TermsFilter struct {
	Filter
	name       string
	values     []interface{}
	cache      *bool
	cacheKey   string
	filterName string
	execution  string
}

func NewTermsFilter(name string, values ...interface{}) TermsFilter {
	f := TermsFilter{
		name:   name,
		values: make([]interface{}, 0),
	}
	f.values = append(f.values, values...)
	return f
}

func (f TermsFilter) Cache(cache bool) TermsFilter {
	f.cache = &cache
	return f
}

func (f TermsFilter) CacheKey(cacheKey string) TermsFilter {
	f.cacheKey = cacheKey
	return f
}

func (f TermsFilter) FilterName(filterName string) TermsFilter {
	f.filterName = filterName
	return f
}

func (f TermsFilter) Execution(execution string) TermsFilter {
	f.execution = execution
	return f
}

func (f TermsFilter) Source() interface{} {
	// {
	//   "terms" : {
	//     "..." : "..."
	//   }
	// }

	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["terms"] = params
	params[f.name] = f.values
	if f.filterName != "" {
		params["_name"] = f.filterName
	}
	if f.execution != "" {
		params["execution"] = f.execution
	}
	if f.cache != nil {
		params["_cache"] = *f.cache
	}
	if f.cacheKey != "" {
		params["_cache_key"] = f.cacheKey
	}

	return source
}

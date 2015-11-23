// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// RegexpFilter allows filtering for regular expressions.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-regexp-filter.html
// and http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-regexp-query.html#regexp-syntax
// for details.
type RegexpFilter struct {
	Filter
	name                  string
	regexp                string
	flags                 *string
	maxDeterminizedStates *int
	cache                 *bool
	cacheKey              string
	filterName            string
}

// NewRegexpFilter sets up a new RegexpFilter.
func NewRegexpFilter(name, regexp string) RegexpFilter {
	return RegexpFilter{name: name, regexp: regexp}
}

// Flags sets the regexp flags.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-regexp-query.html#_optional_operators
// for details.
func (f RegexpFilter) Flags(flags string) RegexpFilter {
	f.flags = &flags
	return f
}

func (f RegexpFilter) MaxDeterminizedStates(maxDeterminizedStates int) RegexpFilter {
	f.maxDeterminizedStates = &maxDeterminizedStates
	return f
}

func (f RegexpFilter) Cache(cache bool) RegexpFilter {
	f.cache = &cache
	return f
}

func (f RegexpFilter) CacheKey(cacheKey string) RegexpFilter {
	f.cacheKey = cacheKey
	return f
}

func (f RegexpFilter) FilterName(filterName string) RegexpFilter {
	f.filterName = filterName
	return f
}

func (f RegexpFilter) Source() interface{} {
	// {
	//   "regexp" : {
	//     "..." : "..."
	//   }
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["regexp"] = params

	if f.flags == nil {
		params[f.name] = f.regexp
	} else {
		x := make(map[string]interface{})
		x["value"] = f.regexp
		x["flags"] = *f.flags
		if f.maxDeterminizedStates != nil {
			x["max_determinized_states"] = *f.maxDeterminizedStates
		}
		params[f.name] = x
	}

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

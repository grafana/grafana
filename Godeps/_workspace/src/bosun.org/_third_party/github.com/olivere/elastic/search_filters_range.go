// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents with fields that have terms within
// a certain range. For details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/range-filter.html
type RangeFilter struct {
	Filter
	name         string
	from         *interface{}
	to           *interface{}
	timeZone     string
	includeLower bool
	includeUpper bool
	cache        *bool
	cacheKey     string
	filterName   string
	execution    string
}

func NewRangeFilter(name string) RangeFilter {
	f := RangeFilter{name: name, includeLower: true, includeUpper: true}
	return f
}

func (f RangeFilter) TimeZone(timeZone string) RangeFilter {
	f.timeZone = timeZone
	return f
}

func (f RangeFilter) From(from interface{}) RangeFilter {
	f.from = &from
	return f
}

func (f RangeFilter) Gt(from interface{}) RangeFilter {
	f.from = &from
	f.includeLower = false
	return f
}

func (f RangeFilter) Gte(from interface{}) RangeFilter {
	f.from = &from
	f.includeLower = true
	return f
}

func (f RangeFilter) To(to interface{}) RangeFilter {
	f.to = &to
	return f
}

func (f RangeFilter) Lt(to interface{}) RangeFilter {
	f.to = &to
	f.includeUpper = false
	return f
}

func (f RangeFilter) Lte(to interface{}) RangeFilter {
	f.to = &to
	f.includeUpper = true
	return f
}

func (f RangeFilter) IncludeLower(includeLower bool) RangeFilter {
	f.includeLower = includeLower
	return f
}

func (f RangeFilter) IncludeUpper(includeUpper bool) RangeFilter {
	f.includeUpper = includeUpper
	return f
}

func (f RangeFilter) Cache(cache bool) RangeFilter {
	f.cache = &cache
	return f
}

func (f RangeFilter) CacheKey(cacheKey string) RangeFilter {
	f.cacheKey = cacheKey
	return f
}

func (f RangeFilter) FilterName(filterName string) RangeFilter {
	f.filterName = filterName
	return f
}

func (f RangeFilter) Execution(execution string) RangeFilter {
	f.execution = execution
	return f
}

func (f RangeFilter) Source() interface{} {
	// {
	//   "range" : {
	//     "name" : {
	//       "..." : "..."
	//     }
	//   }
	// }

	source := make(map[string]interface{})

	rangeQ := make(map[string]interface{})
	source["range"] = rangeQ

	params := make(map[string]interface{})
	rangeQ[f.name] = params

	params["from"] = f.from
	params["to"] = f.to
	if f.timeZone != "" {
		params["time_zone"] = f.timeZone
	}
	params["include_lower"] = f.includeLower
	params["include_upper"] = f.includeUpper

	if f.filterName != "" {
		rangeQ["_name"] = f.filterName
	}

	if f.cache != nil {
		rangeQ["_cache"] = *f.cache
	}

	if f.cacheKey != "" {
		rangeQ["_cache_key"] = f.cacheKey
	}

	if f.execution != "" {
		rangeQ["execution"] = f.execution
	}

	return source
}

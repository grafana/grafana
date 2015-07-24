// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The has_parent filter accepts a query and a parent type.
// The query is executed in the parent document space,
// which is specified by the parent type.
// This filter return child documents which associated parents have matched.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-has-parent-filter.html
type HasParentFilter struct {
	filter     Filter
	query      Query
	parentType string
	filterName string
	cache      *bool
	cacheKey   string
	innerHit   *InnerHit
}

// NewHasParentFilter creates a new has_parent filter.
func NewHasParentFilter(parentType string) HasParentFilter {
	f := HasParentFilter{
		parentType: parentType,
	}
	return f
}

func (f HasParentFilter) Query(query Query) HasParentFilter {
	f.query = query
	return f
}

func (f HasParentFilter) Filter(filter Filter) HasParentFilter {
	f.filter = filter
	return f
}

func (f HasParentFilter) FilterName(filterName string) HasParentFilter {
	f.filterName = filterName
	return f
}

func (f HasParentFilter) Cache(cache bool) HasParentFilter {
	f.cache = &cache
	return f
}

func (f HasParentFilter) CacheKey(cacheKey string) HasParentFilter {
	f.cacheKey = cacheKey
	return f
}

func (f HasParentFilter) InnerHit(innerHit *InnerHit) HasParentFilter {
	f.innerHit = innerHit
	return f
}

// Source returns the JSON document for the filter.
func (f HasParentFilter) Source() interface{} {
	// {
	//   "has_parent" : {
	//       "parent_type" : "blog",
	//       "query" : {
	//           "term" : {
	//               "tag" : "something"
	//           }
	//       }
	//   }
	// }

	source := make(map[string]interface{})

	filter := make(map[string]interface{})
	source["has_parent"] = filter

	if f.query != nil {
		filter["query"] = f.query.Source()
	} else if f.filter != nil {
		filter["filter"] = f.filter.Source()
	}

	filter["parent_type"] = f.parentType
	if f.filterName != "" {
		filter["_name"] = f.filterName
	}
	if f.cache != nil {
		filter["_cache"] = *f.cache
	}
	if f.cacheKey != "" {
		filter["_cache_key"] = f.cacheKey
	}
	if f.innerHit != nil {
		filter["inner_hits"] = f.innerHit.Source()
	}
	return source
}

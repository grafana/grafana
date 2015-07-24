// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A nested filter, works in a similar fashion to the nested query,
// except used as a filter. It follows exactly the same structure, but
// also allows to cache the results (set _cache to true),
// and have it named (set the _name value).
//
// For details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/nested-filter/
type NestedFilter struct {
	query      Query
	filter     Filter
	path       string
	join       *bool
	cache      *bool
	cacheKey   string
	filterName string
	innerHit   *InnerHit
}

func NewNestedFilter(path string) NestedFilter {
	return NestedFilter{path: path}
}

func (f NestedFilter) Query(query Query) NestedFilter {
	f.query = query
	return f
}

func (f NestedFilter) Filter(filter Filter) NestedFilter {
	f.filter = filter
	return f
}

func (f NestedFilter) Path(path string) NestedFilter {
	f.path = path
	return f
}

func (f NestedFilter) Join(join bool) NestedFilter {
	f.join = &join
	return f
}

func (f NestedFilter) Cache(cache bool) NestedFilter {
	f.cache = &cache
	return f
}

func (f NestedFilter) CacheKey(cacheKey string) NestedFilter {
	f.cacheKey = cacheKey
	return f
}

func (f NestedFilter) FilterName(filterName string) NestedFilter {
	f.filterName = filterName
	return f
}

func (f NestedFilter) InnerHit(innerHit *InnerHit) NestedFilter {
	f.innerHit = innerHit
	return f
}

func (f NestedFilter) Source() interface{} {
	//  {
	//      "filtered" : {
	//          "query" : { "match_all" : {} },
	//          "filter" : {
	//              "nested" : {
	//                  "path" : "obj1",
	//                  "query" : {
	//                      "bool" : {
	//                          "must" : [
	//                              {
	//                                  "match" : {"obj1.name" : "blue"}
	//                              },
	//                              {
	//                                  "range" : {"obj1.count" : {"gt" : 5}}
	//                              }
	//                          ]
	//                      }
	//                  },
	//                  "_cache" : true
	//              }
	//          }
	//      }
	//  }
	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["nested"] = params

	if f.query != nil {
		params["query"] = f.query.Source()
	}
	if f.filter != nil {
		params["filter"] = f.filter.Source()
	}
	if f.join != nil {
		params["join"] = *f.join
	}
	params["path"] = f.path
	if f.filterName != "" {
		params["_name"] = f.filterName
	}
	if f.cache != nil {
		params["_cache"] = *f.cache
	}
	if f.cacheKey != "" {
		params["_cache_key"] = f.cacheKey
	}
	if f.innerHit != nil {
		params["inner_hits"] = f.innerHit.Source()
	}

	return source
}

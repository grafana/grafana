// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A filter that matches documents matching boolean combinations
// of other queries. Similar in concept to Boolean query,
// except that the clauses are other filters.
// Can be placed within queries that accept a filter.
// For more details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-bool-filter.html
type BoolFilter struct {
	mustClauses    []Filter
	shouldClauses  []Filter
	mustNotClauses []Filter
	cache          *bool
	cacheKey       string
	filterName     string
}

// NewBoolFilter creates a new bool filter.
func NewBoolFilter() BoolFilter {
	f := BoolFilter{
		mustClauses:    make([]Filter, 0),
		shouldClauses:  make([]Filter, 0),
		mustNotClauses: make([]Filter, 0),
	}
	return f
}

func (f BoolFilter) Must(filters ...Filter) BoolFilter {
	f.mustClauses = append(f.mustClauses, filters...)
	return f
}

func (f BoolFilter) MustNot(filters ...Filter) BoolFilter {
	f.mustNotClauses = append(f.mustNotClauses, filters...)
	return f
}

func (f BoolFilter) Should(filters ...Filter) BoolFilter {
	f.shouldClauses = append(f.shouldClauses, filters...)
	return f
}

func (f BoolFilter) FilterName(filterName string) BoolFilter {
	f.filterName = filterName
	return f
}

func (f BoolFilter) Cache(cache bool) BoolFilter {
	f.cache = &cache
	return f
}

func (f BoolFilter) CacheKey(cacheKey string) BoolFilter {
	f.cacheKey = cacheKey
	return f
}

// Creates the query source for the bool query.
func (f BoolFilter) Source() interface{} {
	// {
	//	"bool" : {
	//		"must" : {
	//			"term" : { "user" : "kimchy" }
	//		},
	//		"must_not" : {
	//			"range" : {
	//				"age" : { "from" : 10, "to" : 20 }
	//			}
	//		},
	//		"should" : [
	//			{
	//				"term" : { "tag" : "wow" }
	//			},
	//			{
	//				"term" : { "tag" : "elasticsearch" }
	//			}
	//		],
	//		"_cache" : true
	//	}
	// }

	source := make(map[string]interface{})

	boolClause := make(map[string]interface{})
	source["bool"] = boolClause

	// must
	if len(f.mustClauses) == 1 {
		boolClause["must"] = f.mustClauses[0].Source()
	} else if len(f.mustClauses) > 1 {
		clauses := make([]interface{}, 0)
		for _, subQuery := range f.mustClauses {
			clauses = append(clauses, subQuery.Source())
		}
		boolClause["must"] = clauses
	}

	// must_not
	if len(f.mustNotClauses) == 1 {
		boolClause["must_not"] = f.mustNotClauses[0].Source()
	} else if len(f.mustNotClauses) > 1 {
		clauses := make([]interface{}, 0)
		for _, subQuery := range f.mustNotClauses {
			clauses = append(clauses, subQuery.Source())
		}
		boolClause["must_not"] = clauses
	}

	// should
	if len(f.shouldClauses) == 1 {
		boolClause["should"] = f.shouldClauses[0].Source()
	} else if len(f.shouldClauses) > 1 {
		clauses := make([]interface{}, 0)
		for _, subQuery := range f.shouldClauses {
			clauses = append(clauses, subQuery.Source())
		}
		boolClause["should"] = clauses
	}

	if f.filterName != "" {
		boolClause["_name"] = f.filterName
	}
	if f.cache != nil {
		boolClause["_cache"] = *f.cache
	}
	if f.cacheKey != "" {
		boolClause["_cache_key"] = f.cacheKey
	}

	return source
}

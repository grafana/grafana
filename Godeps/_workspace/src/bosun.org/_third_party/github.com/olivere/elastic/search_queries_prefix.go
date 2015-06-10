// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Matches documents that have fields containing terms
// with a specified prefix (not analyzed).
// For more details, see
// http://www.elasticsearch.org/guide/reference/query-dsl/prefix-query.html
type PrefixQuery struct {
	Query
	name      string
	prefix    string
	boost     *float32
	rewrite   string
	queryName string
}

// Creates a new prefix query.
func NewPrefixQuery(name string, prefix string) PrefixQuery {
	q := PrefixQuery{name: name, prefix: prefix}
	return q
}

func (q PrefixQuery) Boost(boost float32) PrefixQuery {
	q.boost = &boost
	return q
}

func (q PrefixQuery) Rewrite(rewrite string) PrefixQuery {
	q.rewrite = rewrite
	return q
}

func (q PrefixQuery) QueryName(queryName string) PrefixQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the prefix query.
func (q PrefixQuery) Source() interface{} {
	// {
	//   "prefix" : {
	//     "user" :  {
	//       "prefix" : "ki",
	//       "boost" : 2.0
	//      }
	//    }
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["prefix"] = query

	if q.boost == nil && q.rewrite == "" && q.queryName == "" {
		query[q.name] = q.prefix
	} else {
		subQuery := make(map[string]interface{})
		subQuery["prefix"] = q.prefix
		if q.boost != nil {
			subQuery["boost"] = *q.boost
		}
		if q.rewrite != "" {
			subQuery["rewrite"] = q.rewrite
		}
		if q.queryName != "" {
			subQuery["_name"] = q.queryName
		}
		query[q.name] = subQuery
	}

	return source
}

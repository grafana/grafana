// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The has_parent query works the same as the has_parent filter,
// by automatically wrapping the filter with a
// constant_score (when using the default score type).
// It has the same syntax as the has_parent filter.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-has-parent-query.html
type HasParentQuery struct {
	query      Query
	parentType string
	boost      *float32
	scoreType  string
	queryName  string
	innerHit   *InnerHit
}

// NewHasParentQuery creates a new has_parent query.
func NewHasParentQuery(parentType string, query Query) HasParentQuery {
	q := HasParentQuery{
		query:      query,
		parentType: parentType,
	}
	return q
}

func (q HasParentQuery) Boost(boost float32) HasParentQuery {
	q.boost = &boost
	return q
}

func (q HasParentQuery) ScoreType(scoreType string) HasParentQuery {
	q.scoreType = scoreType
	return q
}

func (q HasParentQuery) QueryName(queryName string) HasParentQuery {
	q.queryName = queryName
	return q
}

func (q HasParentQuery) InnerHit(innerHit *InnerHit) HasParentQuery {
	q.innerHit = innerHit
	return q
}

// Creates the query source for the ids query.
func (q HasParentQuery) Source() interface{} {
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

	query := make(map[string]interface{})
	source["has_parent"] = query

	query["query"] = q.query.Source()
	query["parent_type"] = q.parentType
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.scoreType != "" {
		query["score_type"] = q.scoreType
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}
	if q.innerHit != nil {
		query["inner_hits"] = q.innerHit.Source()
	}
	return source
}

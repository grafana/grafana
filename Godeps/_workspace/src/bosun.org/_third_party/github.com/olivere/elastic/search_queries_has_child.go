// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The has_child query works the same as the has_child filter,
// by automatically wrapping the filter with a constant_score
// (when using the default score type).
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-has-child-query.html
type HasChildQuery struct {
	query              Query
	childType          string
	boost              *float32
	scoreType          string
	minChildren        *int
	maxChildren        *int
	shortCircuitCutoff *int
	queryName          string
	innerHit           *InnerHit
}

// NewHasChildQuery creates a new has_child query.
func NewHasChildQuery(childType string, query Query) HasChildQuery {
	q := HasChildQuery{
		query:     query,
		childType: childType,
	}
	return q
}

func (q HasChildQuery) Boost(boost float32) HasChildQuery {
	q.boost = &boost
	return q
}

func (q HasChildQuery) ScoreType(scoreType string) HasChildQuery {
	q.scoreType = scoreType
	return q
}

func (q HasChildQuery) MinChildren(minChildren int) HasChildQuery {
	q.minChildren = &minChildren
	return q
}

func (q HasChildQuery) MaxChildren(maxChildren int) HasChildQuery {
	q.maxChildren = &maxChildren
	return q
}

func (q HasChildQuery) ShortCircuitCutoff(shortCircuitCutoff int) HasChildQuery {
	q.shortCircuitCutoff = &shortCircuitCutoff
	return q
}

func (q HasChildQuery) QueryName(queryName string) HasChildQuery {
	q.queryName = queryName
	return q
}

func (q HasChildQuery) InnerHit(innerHit *InnerHit) HasChildQuery {
	q.innerHit = innerHit
	return q
}

// Creates the query source for the ids query.
func (q HasChildQuery) Source() interface{} {
	// {
	//   "has_child" : {
	//       "type" : "blog_tag",
	//       "query" : {
	//           "term" : {
	//               "tag" : "something"
	//           }
	//       }
	//   }
	// }
	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["has_child"] = query

	query["query"] = q.query.Source()
	query["type"] = q.childType
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.scoreType != "" {
		query["score_type"] = q.scoreType
	}
	if q.minChildren != nil {
		query["min_children"] = *q.minChildren
	}
	if q.maxChildren != nil {
		query["max_children"] = *q.maxChildren
	}
	if q.shortCircuitCutoff != nil {
		query["short_circuit_cutoff"] = *q.shortCircuitCutoff
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}
	if q.innerHit != nil {
		query["inner_hits"] = q.innerHit.Source()
	}
	return source
}

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A bool query matches documents matching boolean
// combinations of other queries.
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/bool-query.html
type BoolQuery struct {
	Query
	mustClauses        []Query
	shouldClauses      []Query
	mustNotClauses     []Query
	boost              *float32
	disableCoord       *bool
	minimumShouldMatch string
	adjustPureNegative *bool
	queryName          string
}

// Creates a new bool query.
func NewBoolQuery() BoolQuery {
	q := BoolQuery{
		mustClauses:    make([]Query, 0),
		shouldClauses:  make([]Query, 0),
		mustNotClauses: make([]Query, 0),
	}
	return q
}

func (q BoolQuery) Must(queries ...Query) BoolQuery {
	q.mustClauses = append(q.mustClauses, queries...)
	return q
}

func (q BoolQuery) MustNot(queries ...Query) BoolQuery {
	q.mustNotClauses = append(q.mustNotClauses, queries...)
	return q
}

func (q BoolQuery) Should(queries ...Query) BoolQuery {
	q.shouldClauses = append(q.shouldClauses, queries...)
	return q
}

func (q BoolQuery) Boost(boost float32) BoolQuery {
	q.boost = &boost
	return q
}

func (q BoolQuery) DisableCoord(disableCoord bool) BoolQuery {
	q.disableCoord = &disableCoord
	return q
}

func (q BoolQuery) MinimumShouldMatch(minimumShouldMatch string) BoolQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q BoolQuery) AdjustPureNegative(adjustPureNegative bool) BoolQuery {
	q.adjustPureNegative = &adjustPureNegative
	return q
}

func (q BoolQuery) QueryName(queryName string) BoolQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the bool query.
func (q BoolQuery) Source() interface{} {
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
	//		"minimum_number_should_match" : 1,
	//		"boost" : 1.0
	//	}
	// }

	query := make(map[string]interface{})

	boolClause := make(map[string]interface{})
	query["bool"] = boolClause

	// must
	if len(q.mustClauses) == 1 {
		boolClause["must"] = q.mustClauses[0].Source()
	} else if len(q.mustClauses) > 1 {
		clauses := make([]interface{}, 0)
		for _, subQuery := range q.mustClauses {
			clauses = append(clauses, subQuery.Source())
		}
		boolClause["must"] = clauses
	}

	// must_not
	if len(q.mustNotClauses) == 1 {
		boolClause["must_not"] = q.mustNotClauses[0].Source()
	} else if len(q.mustNotClauses) > 1 {
		clauses := make([]interface{}, 0)
		for _, subQuery := range q.mustNotClauses {
			clauses = append(clauses, subQuery.Source())
		}
		boolClause["must_not"] = clauses
	}

	// should
	if len(q.shouldClauses) == 1 {
		boolClause["should"] = q.shouldClauses[0].Source()
	} else if len(q.shouldClauses) > 1 {
		clauses := make([]interface{}, 0)
		for _, subQuery := range q.shouldClauses {
			clauses = append(clauses, subQuery.Source())
		}
		boolClause["should"] = clauses
	}

	if q.boost != nil {
		boolClause["boost"] = *q.boost
	}
	if q.disableCoord != nil {
		boolClause["disable_coord"] = *q.disableCoord
	}
	if q.minimumShouldMatch != "" {
		boolClause["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.adjustPureNegative != nil {
		boolClause["adjust_pure_negative"] = *q.adjustPureNegative
	}
	if q.queryName != "" {
		boolClause["_name"] = q.queryName
	}

	return query
}

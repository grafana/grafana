// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A query that generates the union of documents produced by its subqueries,
// and that scores each document with the maximum score for that document
// as produced by any subquery, plus a tie breaking increment for
// any additional matching subqueries.
//
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/dis-max-query/
type DisMaxQuery struct {
	queries    []Query
	boost      *float32
	tieBreaker *float32
}

// Creates a new dis_max query.
func NewDisMaxQuery() DisMaxQuery {
	q := DisMaxQuery{
		queries: make([]Query, 0),
	}
	return q
}

func (q DisMaxQuery) Query(query Query) DisMaxQuery {
	q.queries = append(q.queries, query)
	return q
}

func (q DisMaxQuery) Boost(boost float32) DisMaxQuery {
	q.boost = &boost
	return q
}

func (q DisMaxQuery) TieBreaker(tieBreaker float32) DisMaxQuery {
	q.tieBreaker = &tieBreaker
	return q
}

// Creates the query source for the dis_max query.
func (q DisMaxQuery) Source() interface{} {
	// {
	//  "dis_max" : {
	//    "tie_breaker" : 0.7,
	//    "boost" : 1.2,
	//    "queries" : {
	//      {
	//        "term" : { "age" : 34 }
	//      },
	//      {
	//        "term" : { "age" : 35 }
	//      }
	//    ]
	//  }
	// }

	query := make(map[string]interface{})

	disMax := make(map[string]interface{})
	query["dis_max"] = disMax

	// tieBreaker
	if q.tieBreaker != nil {
		disMax["tie_breaker"] = *q.tieBreaker
	}

	// boost
	if q.boost != nil {
		disMax["boost"] = *q.boost
	}

	// queries
	clauses := make([]interface{}, 0)
	for _, subQuery := range q.queries {
		clauses = append(clauses, subQuery.Source())
	}
	disMax["queries"] = clauses

	return query
}

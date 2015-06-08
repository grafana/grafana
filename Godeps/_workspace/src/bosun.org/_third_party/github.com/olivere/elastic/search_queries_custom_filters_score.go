// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A custom_filters_score query allows to execute a query,
// and if the hit matches a provided filter (ordered),
// use either a boost or a script associated with it to compute the score.
//
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/custom-filters-score-query/
type CustomFiltersScoreQuery struct {
	query     Query
	filters   []Filter
	scoreMode string
	maxBoost  *float32
	script    string
}

// Creates a new custom_filters_score query.
func NewCustomFiltersScoreQuery() CustomFiltersScoreQuery {
	q := CustomFiltersScoreQuery{
		filters: make([]Filter, 0),
	}
	return q
}

func (q CustomFiltersScoreQuery) Query(query Query) CustomFiltersScoreQuery {
	q.query = query
	return q
}

func (q CustomFiltersScoreQuery) Filter(filter Filter) CustomFiltersScoreQuery {
	q.filters = append(q.filters, filter)
	return q
}

func (q CustomFiltersScoreQuery) ScoreMode(scoreMode string) CustomFiltersScoreQuery {
	q.scoreMode = scoreMode
	return q
}

func (q CustomFiltersScoreQuery) MaxBoost(maxBoost float32) CustomFiltersScoreQuery {
	q.maxBoost = &maxBoost
	return q
}

func (q CustomFiltersScoreQuery) Script(script string) CustomFiltersScoreQuery {
	q.script = script
	return q
}

// Creates the query source for the custom_filters_score query.
func (q CustomFiltersScoreQuery) Source() interface{} {
	// {
	//   "custom_filters_score" : {
	//    "query" : {
	//      "match_all" : {}
	//    },
	//    "filters" : [
	//      {
	//        "filter" : { "range" : { "age" : {"from" : 0, "to" : 10} } },
	//        "boost" : "3"
	//      },
	//      {
	//        "filter" : { "range" : { "age" : {"from" : 10, "to" : 20} } },
	//        "boost" : "2"
	//      }
	//     ],
	//     "score_mode" : "first"
	//   }
	// }

	query := make(map[string]interface{})

	cfs := make(map[string]interface{})
	query["custom_filters_score"] = cfs

	// query
	if q.query != nil {
		cfs["query"] = q.query.Source()
	}
	// filters
	clauses := make([]interface{}, 0)
	for _, filter := range q.filters {
		clauses = append(clauses, filter.Source())
	}
	cfs["filters"] = clauses

	// scoreMode
	if q.scoreMode != "" {
		cfs["score_mode"] = q.scoreMode
	}

	// max_boost
	if q.maxBoost != nil {
		cfs["max_boost"] = *q.maxBoost
	}

	// script
	if q.script != "" {
		cfs["script"] = q.script
	}

	return query
}

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The function_score allows you to modify the score of documents that
// are retrieved by a query. This can be useful if, for example,
// a score function is computationally expensive and it is sufficient
// to compute the score on a filtered set of documents.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-function-score-query.html
type FunctionScoreQuery struct {
	query      Query
	filter     Filter
	boost      *float32
	maxBoost   *float32
	scoreMode  string
	boostMode  string
	filters    []Filter
	scoreFuncs []ScoreFunction
}

// NewFunctionScoreQuery creates a new function score query.
func NewFunctionScoreQuery() FunctionScoreQuery {
	return FunctionScoreQuery{
		filters:    make([]Filter, 0),
		scoreFuncs: make([]ScoreFunction, 0),
	}
}

func (q FunctionScoreQuery) Query(query Query) FunctionScoreQuery {
	q.query = query
	q.filter = nil
	return q
}

func (q FunctionScoreQuery) Filter(filter Filter) FunctionScoreQuery {
	q.query = nil
	q.filter = filter
	return q
}

func (q FunctionScoreQuery) Add(filter Filter, scoreFunc ScoreFunction) FunctionScoreQuery {
	q.filters = append(q.filters, filter)
	q.scoreFuncs = append(q.scoreFuncs, scoreFunc)
	return q
}

func (q FunctionScoreQuery) AddScoreFunc(scoreFunc ScoreFunction) FunctionScoreQuery {
	q.filters = append(q.filters, nil)
	q.scoreFuncs = append(q.scoreFuncs, scoreFunc)
	return q
}

func (q FunctionScoreQuery) ScoreMode(scoreMode string) FunctionScoreQuery {
	q.scoreMode = scoreMode
	return q
}

func (q FunctionScoreQuery) BoostMode(boostMode string) FunctionScoreQuery {
	q.boostMode = boostMode
	return q
}

func (q FunctionScoreQuery) MaxBoost(maxBoost float32) FunctionScoreQuery {
	q.maxBoost = &maxBoost
	return q
}

func (q FunctionScoreQuery) Boost(boost float32) FunctionScoreQuery {
	q.boost = &boost
	return q
}

// Source returns JSON for the function score query.
func (q FunctionScoreQuery) Source() interface{} {
	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["function_score"] = query

	if q.query != nil {
		query["query"] = q.query.Source()
	} else if q.filter != nil {
		query["filter"] = q.filter.Source()
	}

	if len(q.filters) == 1 && q.filters[0] == nil {
		query[q.scoreFuncs[0].Name()] = q.scoreFuncs[0].Source()
	} else {
		funcs := make([]interface{}, len(q.filters))
		for i, filter := range q.filters {
			hsh := make(map[string]interface{})
			if filter != nil {
				hsh["filter"] = filter.Source()
			}
			hsh[q.scoreFuncs[i].Name()] = q.scoreFuncs[i].Source()
			funcs[i] = hsh
		}
		query["functions"] = funcs
	}

	if q.scoreMode != "" {
		query["score_mode"] = q.scoreMode
	}
	if q.boostMode != "" {
		query["boost_mode"] = q.boostMode
	}
	if q.maxBoost != nil {
		query["max_boost"] = *q.maxBoost
	}
	if q.boost != nil {
		query["boost"] = *q.boost
	}

	return source
}

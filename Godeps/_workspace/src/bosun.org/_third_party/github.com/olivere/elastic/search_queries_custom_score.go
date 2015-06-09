// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// custom_score query allows to wrap another query and customize
// the scoring of it optionally with a computation derived from
// other field values in the doc (numeric ones) using script expression.
//
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/custom-score-query/
type CustomScoreQuery struct {
	query  Query
	filter Filter
	script string
	lang   string
	boost  *float32
	params map[string]interface{}
}

// Creates a new custom_score query.
func NewCustomScoreQuery() CustomScoreQuery {
	q := CustomScoreQuery{
		params: make(map[string]interface{}),
	}
	return q
}

func (q CustomScoreQuery) Query(query Query) CustomScoreQuery {
	q.query = query
	return q
}

func (q CustomScoreQuery) Filter(filter Filter) CustomScoreQuery {
	q.filter = filter
	return q
}

func (q CustomScoreQuery) Script(script string) CustomScoreQuery {
	q.script = script
	return q
}

func (q CustomScoreQuery) Lang(lang string) CustomScoreQuery {
	q.lang = lang
	return q
}

func (q CustomScoreQuery) Boost(boost float32) CustomScoreQuery {
	q.boost = &boost
	return q
}

func (q CustomScoreQuery) Params(params map[string]interface{}) CustomScoreQuery {
	q.params = params
	return q
}

func (q CustomScoreQuery) Param(name string, value interface{}) CustomScoreQuery {
	q.params[name] = value
	return q
}

// Creates the query source for the custom_fscore query.
func (q CustomScoreQuery) Source() interface{} {
	// "custom_score" : {
	//     "query" : {
	//         ....
	//     },
	//     "params" : {
	//         "param1" : 2,
	//         "param2" : 3.1
	//     },
	//     "script" : "_score * doc['my_numeric_field'].value / pow(param1, param2)"
	// }

	query := make(map[string]interface{})

	csq := make(map[string]interface{})
	query["custom_score"] = csq

	// query
	if q.query != nil {
		csq["query"] = q.query.Source()
	} else if q.filter != nil {
		csq["filter"] = q.filter.Source()
	}

	csq["script"] = q.script

	// lang
	if q.lang != "" {
		csq["lang"] = q.lang
	}

	// params
	if len(q.params) > 0 {
		csq["params"] = q.params
	}

	// boost
	if q.boost != nil {
		csq["boost"] = *q.boost
	}

	return query
}

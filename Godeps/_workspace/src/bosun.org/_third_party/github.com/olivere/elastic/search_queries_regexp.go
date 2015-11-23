// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// RegexpQuery allows you to use regular expression term queries.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-regexp-query.html.
type RegexpQuery struct {
	Query
	name                  string
	regexp                string
	flags                 *string
	boost                 *float64
	rewrite               *string
	queryName             *string
	maxDeterminizedStates *int
}

// NewRegexpQuery creates a new regexp query.
func NewRegexpQuery(name string, regexp string) RegexpQuery {
	return RegexpQuery{name: name, regexp: regexp}
}

// Flags sets the regexp flags.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-regexp-query.html#_optional_operators
// for details.
func (q RegexpQuery) Flags(flags string) RegexpQuery {
	q.flags = &flags
	return q
}

func (q RegexpQuery) MaxDeterminizedStates(maxDeterminizedStates int) RegexpQuery {
	q.maxDeterminizedStates = &maxDeterminizedStates
	return q
}

func (q RegexpQuery) Boost(boost float64) RegexpQuery {
	q.boost = &boost
	return q
}

func (q RegexpQuery) Rewrite(rewrite string) RegexpQuery {
	q.rewrite = &rewrite
	return q
}

func (q RegexpQuery) QueryName(queryName string) RegexpQuery {
	q.queryName = &queryName
	return q
}

// Source returns the JSON-serializable query data.
func (q RegexpQuery) Source() interface{} {
	// {
	//   "regexp" : {
	//     "name.first" :  {
	//       "value" : "s.*y",
	//       "boost" : 1.2
	//      }
	//    }
	// }

	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["regexp"] = query

	x := make(map[string]interface{})
	x["value"] = q.regexp
	if q.flags != nil {
		x["flags"] = *q.flags
	}
	if q.maxDeterminizedStates != nil {
		x["max_determinized_states"] = *q.maxDeterminizedStates
	}
	if q.boost != nil {
		x["boost"] = *q.boost
	}
	if q.rewrite != nil {
		x["rewrite"] = *q.rewrite
	}
	if q.queryName != nil {
		x["name"] = *q.queryName
	}
	query[q.name] = x

	return source
}

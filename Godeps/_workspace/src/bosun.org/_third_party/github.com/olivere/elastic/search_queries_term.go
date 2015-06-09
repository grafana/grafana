// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A term query matches documents that contain
// a term (not analyzed). For more details, see
// http://www.elasticsearch.org/guide/reference/query-dsl/term-query.html
type TermQuery struct {
	Query
	name      string
	value     interface{}
	boost     *float32
	queryName string
}

// Creates a new term query.
func NewTermQuery(name string, value interface{}) TermQuery {
	t := TermQuery{name: name, value: value}
	return t
}

func (q TermQuery) Boost(boost float32) TermQuery {
	q.boost = &boost
	return q
}

func (q TermQuery) QueryName(queryName string) TermQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the term query.
func (q TermQuery) Source() interface{} {
	// {"term":{"name":"value"}}
	source := make(map[string]interface{})
	tq := make(map[string]interface{})
	source["term"] = tq

	if q.boost == nil && q.queryName == "" {
		tq[q.name] = q.value
	} else {
		subQ := make(map[string]interface{})
		subQ["value"] = q.value
		if q.boost != nil {
			subQ["boost"] = *q.boost
		}
		if q.queryName != "" {
			subQ["_name"] = q.queryName
		}
		tq[q.name] = subQ
	}
	return source
}

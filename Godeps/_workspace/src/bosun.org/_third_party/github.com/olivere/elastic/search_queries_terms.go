// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A query that match on any (configurable) of the provided terms.
// This is a simpler syntax query for using a bool query with
// several term queries in the should clauses.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-terms-query.html
type TermsQuery struct {
	Query
	name               string
	values             []interface{}
	minimumShouldMatch string
	disableCoord       *bool
	boost              *float32
	queryName          string
}

// NewTermsQuery creates a new terms query.
func NewTermsQuery(name string, values ...interface{}) TermsQuery {
	t := TermsQuery{
		name:   name,
		values: make([]interface{}, 0),
	}
	if len(values) > 0 {
		t.values = append(t.values, values...)
	}
	return t
}

func (q TermsQuery) MinimumShouldMatch(minimumShouldMatch string) TermsQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q TermsQuery) DisableCoord(disableCoord bool) TermsQuery {
	q.disableCoord = &disableCoord
	return q
}

func (q TermsQuery) Boost(boost float32) TermsQuery {
	q.boost = &boost
	return q
}

func (q TermsQuery) QueryName(queryName string) TermsQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the term query.
func (q TermsQuery) Source() interface{} {
	// {"terms":{"name":["value1","value2"]}}
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["terms"] = params
	params[q.name] = q.values
	if q.minimumShouldMatch != "" {
		params["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.disableCoord != nil {
		params["disable_coord"] = *q.disableCoord
	}
	if q.boost != nil {
		params["boost"] = *q.boost
	}
	if q.queryName != "" {
		params["_name"] = q.queryName
	}
	return source
}

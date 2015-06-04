// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// WildcardQuery matches documents that have fields matching a wildcard
// expression (not analyzed). Supported wildcards are *, which matches
// any character sequence (including the empty one), and ?, which matches
// any single character. Note this query can be slow, as it needs to iterate
// over many terms. In order to prevent extremely slow wildcard queries,
// a wildcard term should not start with one of the wildcards * or ?.
// The wildcard query maps to Lucene WildcardQuery.
//
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-wildcard-query.html.
type WildcardQuery struct {
	Query

	name      string
	wildcard  string
	boost     float32
	rewrite   string
	queryName string
}

// NewWildcardQuery creates a new wildcard query.
func NewWildcardQuery(name, wildcard string) WildcardQuery {
	q := WildcardQuery{
		name:     name,
		wildcard: wildcard,
		boost:    -1.0,
	}
	return q
}

// Name is the name of the field name.
func (q WildcardQuery) Name(name string) WildcardQuery {
	q.name = name
	return q
}

// Wildcard is the wildcard to be used in the query, e.g. ki*y??.
func (q WildcardQuery) Wildcard(wildcard string) WildcardQuery {
	q.wildcard = wildcard
	return q
}

// Boost sets the boost for this query.
func (q WildcardQuery) Boost(boost float32) WildcardQuery {
	q.boost = boost
	return q
}

// Rewrite controls the rewriting.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-multi-term-rewrite.html
// for details.
func (q WildcardQuery) Rewrite(rewrite string) WildcardQuery {
	q.rewrite = rewrite
	return q
}

// QueryName sets the name of this query.
func (q WildcardQuery) QueryName(queryName string) WildcardQuery {
	q.queryName = queryName
	return q
}

// Source returns the JSON serializable body of this query.
func (q WildcardQuery) Source() interface{} {
	// {
	//	"wildcard" : {
	//		"user" : {
	//      "wildcard" : "ki*y",
	//      "boost" : 1.0
	//    }
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["wildcard"] = query

	wq := make(map[string]interface{})
	query[q.name] = wq

	wq["wildcard"] = q.wildcard

	if q.boost != -1.0 {
		wq["boost"] = q.boost
	}
	if q.rewrite != "" {
		wq["rewrite"] = q.rewrite
	}
	if q.queryName != "" {
		wq["_name"] = q.queryName
	}

	return source
}

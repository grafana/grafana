// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A filter that matches on all documents.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-match-all-filter.html
type MatchAllFilter struct {
	Filter
}

func NewMatchAllFilter() MatchAllFilter {
	return MatchAllFilter{}
}

func (f MatchAllFilter) Source() interface{} {
	// {
	//   "match_all" : {}
	// }
	source := make(map[string]interface{})
	source["match_all"] = make(map[string]interface{})
	return source
}

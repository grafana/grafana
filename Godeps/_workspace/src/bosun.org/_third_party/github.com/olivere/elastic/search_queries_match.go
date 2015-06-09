// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Match query is a family of match queries that
// accept text/numerics/dates, analyzes it, and
// constructs a query out of it. For more details,
// see http://www.elasticsearch.org/guide/reference/query-dsl/match-query.html
type MatchQuery struct {
	Query
	name                string
	value               interface{}
	matchQueryType      string // boolean, phrase, phrase_prefix
	operator            string // or / and
	analyzer            string
	boost               *float32
	slop                *int
	fuzziness           string
	prefixLength        *int
	maxExpansions       *int
	minimumShouldMatch  string
	rewrite             string
	fuzzyRewrite        string
	lenient             *bool
	fuzzyTranspositions *bool
	zeroTermsQuery      string
	cutoffFrequency     *float32
	queryName           string
}

func NewMatchQuery(name string, value interface{}) MatchQuery {
	q := MatchQuery{name: name, value: value}
	return q
}

// Type can be "boolean", "phrase", or "phrase_prefix".
func (q MatchQuery) Type(matchQueryType string) MatchQuery {
	q.matchQueryType = matchQueryType
	return q
}

func (q MatchQuery) Operator(operator string) MatchQuery {
	q.operator = operator
	return q
}

func (q MatchQuery) Analyzer(analyzer string) MatchQuery {
	q.analyzer = analyzer
	return q
}

func (q MatchQuery) Boost(boost float32) MatchQuery {
	q.boost = &boost
	return q
}

func (q MatchQuery) Slop(slop int) MatchQuery {
	q.slop = &slop
	return q
}

func (q MatchQuery) Fuzziness(fuzziness string) MatchQuery {
	q.fuzziness = fuzziness
	return q
}

func (q MatchQuery) PrefixLength(prefixLength int) MatchQuery {
	q.prefixLength = &prefixLength
	return q
}

func (q MatchQuery) MaxExpansions(maxExpansions int) MatchQuery {
	q.maxExpansions = &maxExpansions
	return q
}

func (q MatchQuery) MinimumShouldMatch(minimumShouldMatch string) MatchQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q MatchQuery) Rewrite(rewrite string) MatchQuery {
	q.rewrite = rewrite
	return q
}

func (q MatchQuery) FuzzyRewrite(fuzzyRewrite string) MatchQuery {
	q.fuzzyRewrite = fuzzyRewrite
	return q
}

func (q MatchQuery) Lenient(lenient bool) MatchQuery {
	q.lenient = &lenient
	return q
}

func (q MatchQuery) FuzzyTranspositions(fuzzyTranspositions bool) MatchQuery {
	q.fuzzyTranspositions = &fuzzyTranspositions
	return q
}

// ZeroTermsQuery can be "all" or "none".
func (q MatchQuery) ZeroTermsQuery(zeroTermsQuery string) MatchQuery {
	q.zeroTermsQuery = zeroTermsQuery
	return q
}

func (q MatchQuery) CutoffFrequency(cutoff float32) MatchQuery {
	q.cutoffFrequency = &cutoff
	return q
}

func (q MatchQuery) QueryName(queryName string) MatchQuery {
	q.queryName = queryName
	return q
}

func (q MatchQuery) Source() interface{} {
	// {"match":{"name":{"query":"value","type":"boolean/phrase"}}}
	source := make(map[string]interface{})

	match := make(map[string]interface{})
	source["match"] = match

	query := make(map[string]interface{})
	match[q.name] = query

	query["query"] = q.value

	if q.matchQueryType != "" {
		query["type"] = q.matchQueryType
	}
	if q.operator != "" {
		query["operator"] = q.operator
	}
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.slop != nil {
		query["slop"] = *q.slop
	}
	if q.fuzziness != "" {
		query["fuzziness"] = q.fuzziness
	}
	if q.prefixLength != nil {
		query["prefix_length"] = *q.prefixLength
	}
	if q.maxExpansions != nil {
		query["max_expansions"] = *q.maxExpansions
	}
	if q.minimumShouldMatch != "" {
		query["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.rewrite != "" {
		query["rewrite"] = q.rewrite
	}
	if q.fuzzyRewrite != "" {
		query["fuzzy_rewrite"] = q.fuzzyRewrite
	}
	if q.lenient != nil {
		query["lenient"] = *q.lenient
	}
	if q.fuzzyTranspositions != nil {
		query["fuzzy_transpositions"] = *q.fuzzyTranspositions
	}
	if q.zeroTermsQuery != "" {
		query["zero_terms_query"] = q.zeroTermsQuery
	}
	if q.cutoffFrequency != nil {
		query["cutoff_frequency"] = q.cutoffFrequency
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}

	return source
}

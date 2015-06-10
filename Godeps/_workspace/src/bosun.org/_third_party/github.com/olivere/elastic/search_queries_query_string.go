// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
)

// A query that uses the query parser in order to parse
// its content. For more details, see
// http://www.elasticsearch.org/guide/reference/query-dsl/query-string-query.html
type QueryStringQuery struct {
	Query

	queryString               string
	defaultField              string
	defaultOper               string
	analyzer                  string
	quoteAnalyzer             string
	quoteFieldSuffix          string
	autoGeneratePhraseQueries *bool
	allowLeadingWildcard      *bool
	lowercaseExpandedTerms    *bool
	enablePositionIncrements  *bool
	analyzeWildcard           *bool
	boost                     *float32
	fuzzyMinSim               *float32
	fuzzyPrefixLength         *int
	fuzzyMaxExpansions        *int
	fuzzyRewrite              string
	phraseSlop                *int
	fields                    []string
	fieldBoosts               map[string]*float32
	useDisMax                 *bool
	tieBreaker                *float32
	rewrite                   string
	minimumShouldMatch        string
	lenient                   *bool
}

// Creates a new query string query.
func NewQueryStringQuery(queryString string) QueryStringQuery {
	q := QueryStringQuery{
		queryString: queryString,
		fields:      make([]string, 0),
		fieldBoosts: make(map[string]*float32),
	}
	return q
}

func (q QueryStringQuery) DefaultField(defaultField string) QueryStringQuery {
	q.defaultField = defaultField
	return q
}

func (q QueryStringQuery) Field(field string) QueryStringQuery {
	q.fields = append(q.fields, field)
	return q
}

func (q QueryStringQuery) FieldWithBoost(field string, boost float32) QueryStringQuery {
	q.fields = append(q.fields, field)
	q.fieldBoosts[field] = &boost
	return q
}

func (q QueryStringQuery) UseDisMax(useDisMax bool) QueryStringQuery {
	q.useDisMax = &useDisMax
	return q
}

func (q QueryStringQuery) TieBreaker(tieBreaker float32) QueryStringQuery {
	q.tieBreaker = &tieBreaker
	return q
}

func (q QueryStringQuery) DefaultOperator(operator string) QueryStringQuery {
	q.defaultOper = operator
	return q
}

func (q QueryStringQuery) Analyzer(analyzer string) QueryStringQuery {
	q.analyzer = analyzer
	return q
}

func (q QueryStringQuery) QuoteAnalyzer(quoteAnalyzer string) QueryStringQuery {
	q.quoteAnalyzer = quoteAnalyzer
	return q
}

func (q QueryStringQuery) AutoGeneratePhraseQueries(autoGeneratePhraseQueries bool) QueryStringQuery {
	q.autoGeneratePhraseQueries = &autoGeneratePhraseQueries
	return q
}

func (q QueryStringQuery) AllowLeadingWildcard(allowLeadingWildcard bool) QueryStringQuery {
	q.allowLeadingWildcard = &allowLeadingWildcard
	return q
}

func (q QueryStringQuery) LowercaseExpandedTerms(lowercaseExpandedTerms bool) QueryStringQuery {
	q.lowercaseExpandedTerms = &lowercaseExpandedTerms
	return q
}

func (q QueryStringQuery) EnablePositionIncrements(enablePositionIncrements bool) QueryStringQuery {
	q.enablePositionIncrements = &enablePositionIncrements
	return q
}

func (q QueryStringQuery) FuzzyMinSim(fuzzyMinSim float32) QueryStringQuery {
	q.fuzzyMinSim = &fuzzyMinSim
	return q
}

func (q QueryStringQuery) FuzzyMaxExpansions(fuzzyMaxExpansions int) QueryStringQuery {
	q.fuzzyMaxExpansions = &fuzzyMaxExpansions
	return q
}

func (q QueryStringQuery) FuzzyRewrite(fuzzyRewrite string) QueryStringQuery {
	q.fuzzyRewrite = fuzzyRewrite
	return q
}

func (q QueryStringQuery) PhraseSlop(phraseSlop int) QueryStringQuery {
	q.phraseSlop = &phraseSlop
	return q
}

func (q QueryStringQuery) AnalyzeWildcard(analyzeWildcard bool) QueryStringQuery {
	q.analyzeWildcard = &analyzeWildcard
	return q
}

func (q QueryStringQuery) Rewrite(rewrite string) QueryStringQuery {
	q.rewrite = rewrite
	return q
}

func (q QueryStringQuery) MinimumShouldMatch(minimumShouldMatch string) QueryStringQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q QueryStringQuery) Boost(boost float32) QueryStringQuery {
	q.boost = &boost
	return q
}

func (q QueryStringQuery) QuoteFieldSuffix(quoteFieldSuffix string) QueryStringQuery {
	q.quoteFieldSuffix = quoteFieldSuffix
	return q
}

func (q QueryStringQuery) Lenient(lenient bool) QueryStringQuery {
	q.lenient = &lenient
	return q
}

// Creates the query source for the query string query.
func (q QueryStringQuery) Source() interface{} {
	// {
	//    "query_string" : {
	//      "default_field" : "content",
	//      "query" : "this AND that OR thus"
	//    }
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["query_string"] = query

	query["query"] = q.queryString

	if q.defaultField != "" {
		query["default_field"] = q.defaultField
	}

	if len(q.fields) > 0 {
		fields := make([]string, 0)
		for _, field := range q.fields {
			if boost, found := q.fieldBoosts[field]; found {
				if boost != nil {
					fields = append(fields, fmt.Sprintf("%s^%f", field, *boost))
				} else {
					fields = append(fields, field)
				}
			} else {
				fields = append(fields, field)
			}
		}
		query["fields"] = fields
	}

	if q.tieBreaker != nil {
		query["tie_breaker"] = *q.tieBreaker
	}

	if q.useDisMax != nil {
		query["use_dis_max"] = *q.useDisMax
	}

	if q.defaultOper != "" {
		query["default_operator"] = q.defaultOper
	}

	if q.analyzer != "" {
		query["analyzer"] = q.analyzer
	}

	if q.quoteAnalyzer != "" {
		query["quote_analyzer"] = q.quoteAnalyzer
	}

	if q.autoGeneratePhraseQueries != nil {
		query["auto_generate_phrase_queries"] = *q.autoGeneratePhraseQueries
	}

	if q.allowLeadingWildcard != nil {
		query["allow_leading_wildcard"] = *q.allowLeadingWildcard
	}

	if q.lowercaseExpandedTerms != nil {
		query["lowercase_expanded_terms"] = *q.lowercaseExpandedTerms
	}

	if q.enablePositionIncrements != nil {
		query["enable_position_increments"] = *q.enablePositionIncrements
	}

	if q.fuzzyMinSim != nil {
		query["fuzzy_min_sim"] = *q.fuzzyMinSim
	}

	if q.boost != nil {
		query["boost"] = *q.boost
	}

	if q.fuzzyPrefixLength != nil {
		query["fuzzy_prefix_length"] = *q.fuzzyPrefixLength
	}

	if q.fuzzyMaxExpansions != nil {
		query["fuzzy_max_expansions"] = *q.fuzzyMaxExpansions
	}

	if q.fuzzyRewrite != "" {
		query["fuzzy_rewrite"] = q.fuzzyRewrite
	}

	if q.phraseSlop != nil {
		query["phrase_slop"] = *q.phraseSlop
	}

	if q.analyzeWildcard != nil {
		query["analyze_wildcard"] = *q.analyzeWildcard
	}

	if q.rewrite != "" {
		query["rewrite"] = q.rewrite
	}

	if q.minimumShouldMatch != "" {
		query["minimum_should_match"] = q.minimumShouldMatch
	}

	if q.quoteFieldSuffix != "" {
		query["quote_field_suffix"] = q.quoteFieldSuffix
	}

	if q.lenient != nil {
		query["lenient"] = *q.lenient
	}

	return source
}

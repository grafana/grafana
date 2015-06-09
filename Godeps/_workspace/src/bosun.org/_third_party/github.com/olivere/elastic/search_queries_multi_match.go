// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"strings"
)

// The multi_match query builds further on top of the match query by allowing multiple fields to be specified.
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/multi-match-query.html
type MultiMatchQuery struct {
	Query
	text               interface{}
	fields             []string
	fieldBoosts        map[string]*float32
	matchQueryType     string // best_fields, most_fields, cross_fields, phrase, phrase_prefix
	operator           string // and / or
	analyzer           string
	boost              *float32
	slop               *int
	fuzziness          string
	prefixLength       *int
	maxExpansions      *int
	minimumShouldMatch string
	rewrite            string
	fuzzyRewrite       string
	useDisMax          *bool
	tieBreaker         *float32
	lenient            *bool
	cutoffFrequency    *float32
	zeroTermsQuery     string
	queryName          string
}

func NewMultiMatchQuery(text interface{}, fields ...string) MultiMatchQuery {
	q := MultiMatchQuery{
		text:        text,
		fields:      make([]string, 0),
		fieldBoosts: make(map[string]*float32),
	}
	q.fields = append(q.fields, fields...)
	return q
}

func (q MultiMatchQuery) Field(field string) MultiMatchQuery {
	q.fields = append(q.fields, field)
	return q
}

func (q MultiMatchQuery) FieldWithBoost(field string, boost float32) MultiMatchQuery {
	q.fields = append(q.fields, field)
	q.fieldBoosts[field] = &boost
	return q
}

// Type can be: "best_fields", "boolean", "most_fields", "cross_fields",
// "phrase", or "phrase_prefix".
func (q MultiMatchQuery) Type(matchQueryType string) MultiMatchQuery {
	zero := float32(0.0)
	one := float32(1.0)

	switch strings.ToLower(matchQueryType) {
	default: // best_fields / boolean
		q.matchQueryType = "best_fields"
		q.tieBreaker = &zero
	case "most_fields":
		q.matchQueryType = "most_fields"
		q.tieBreaker = &one
	case "cross_fields":
		q.matchQueryType = "cross_fields"
		q.tieBreaker = &zero
	case "phrase":
		q.matchQueryType = "phrase"
		q.tieBreaker = &zero
	case "phrase_prefix":
		q.matchQueryType = "phrase_prefix"
		q.tieBreaker = &zero
	}
	return q
}

func (q MultiMatchQuery) Operator(operator string) MultiMatchQuery {
	q.operator = operator
	return q
}

func (q MultiMatchQuery) Analyzer(analyzer string) MultiMatchQuery {
	q.analyzer = analyzer
	return q
}

func (q MultiMatchQuery) Boost(boost float32) MultiMatchQuery {
	q.boost = &boost
	return q
}

func (q MultiMatchQuery) Slop(slop int) MultiMatchQuery {
	q.slop = &slop
	return q
}

func (q MultiMatchQuery) Fuzziness(fuzziness string) MultiMatchQuery {
	q.fuzziness = fuzziness
	return q
}

func (q MultiMatchQuery) PrefixLength(prefixLength int) MultiMatchQuery {
	q.prefixLength = &prefixLength
	return q
}

func (q MultiMatchQuery) MaxExpansions(maxExpansions int) MultiMatchQuery {
	q.maxExpansions = &maxExpansions
	return q
}

func (q MultiMatchQuery) MinimumShouldMatch(minimumShouldMatch string) MultiMatchQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q MultiMatchQuery) Rewrite(rewrite string) MultiMatchQuery {
	q.rewrite = rewrite
	return q
}

func (q MultiMatchQuery) FuzzyRewrite(fuzzyRewrite string) MultiMatchQuery {
	q.fuzzyRewrite = fuzzyRewrite
	return q
}

// Deprecated.
func (q MultiMatchQuery) UseDisMax(useDisMax bool) MultiMatchQuery {
	q.useDisMax = &useDisMax
	return q
}

func (q MultiMatchQuery) TieBreaker(tieBreaker float32) MultiMatchQuery {
	q.tieBreaker = &tieBreaker
	return q
}

func (q MultiMatchQuery) Lenient(lenient bool) MultiMatchQuery {
	q.lenient = &lenient
	return q
}

func (q MultiMatchQuery) CutoffFrequency(cutoff float32) MultiMatchQuery {
	q.cutoffFrequency = &cutoff
	return q
}

// ZeroTermsQuery can be "all" or "none".
func (q MultiMatchQuery) ZeroTermsQuery(zeroTermsQuery string) MultiMatchQuery {
	q.zeroTermsQuery = zeroTermsQuery
	return q
}

func (q MultiMatchQuery) QueryName(queryName string) MultiMatchQuery {
	q.queryName = queryName
	return q
}

func (q MultiMatchQuery) Source() interface{} {
	//
	// {
	//   "multi_match" : {
	//     "query" : "this is a test",
	//     "fields" : [ "subject", "message" ]
	//   }
	// }

	source := make(map[string]interface{})

	multiMatch := make(map[string]interface{})
	source["multi_match"] = multiMatch

	multiMatch["query"] = q.text

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
		multiMatch["fields"] = fields
	}

	if q.matchQueryType != "" {
		multiMatch["type"] = q.matchQueryType
	}

	if q.operator != "" {
		multiMatch["operator"] = q.operator
	}
	if q.analyzer != "" {
		multiMatch["analyzer"] = q.analyzer
	}
	if q.boost != nil {
		multiMatch["boost"] = *q.boost
	}
	if q.slop != nil {
		multiMatch["slop"] = *q.slop
	}
	if q.fuzziness != "" {
		multiMatch["fuzziness"] = q.fuzziness
	}
	if q.prefixLength != nil {
		multiMatch["prefix_length"] = *q.prefixLength
	}
	if q.maxExpansions != nil {
		multiMatch["max_expansions"] = *q.maxExpansions
	}
	if q.minimumShouldMatch != "" {
		multiMatch["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.rewrite != "" {
		multiMatch["rewrite"] = q.rewrite
	}
	if q.fuzzyRewrite != "" {
		multiMatch["fuzzy_rewrite"] = q.fuzzyRewrite
	}
	if q.useDisMax != nil {
		multiMatch["use_dis_max"] = *q.useDisMax
	}
	if q.tieBreaker != nil {
		multiMatch["tie_breaker"] = *q.tieBreaker
	}
	if q.lenient != nil {
		multiMatch["lenient"] = *q.lenient
	}
	if q.cutoffFrequency != nil {
		multiMatch["cutoff_frequency"] = *q.cutoffFrequency
	}
	if q.zeroTermsQuery != "" {
		multiMatch["zero_terms_query"] = q.zeroTermsQuery
	}
	if q.queryName != "" {
		multiMatch["_name"] = q.queryName
	}
	return source
}

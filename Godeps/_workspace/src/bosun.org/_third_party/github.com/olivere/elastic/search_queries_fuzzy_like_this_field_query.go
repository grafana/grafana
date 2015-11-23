// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// FuzzyLikeThisFieldQuery is the same as the fuzzy_like_this query,
// except that it runs against a single field. It provides nicer query DSL
// over the generic fuzzy_like_this query, and support typed fields query
// (automatically wraps typed fields with type filter to match only on the specific type).
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-flt-field-query.html
type FuzzyLikeThisFieldQuery struct {
	Query

	field                  string
	boost                  *float32
	likeText               *string
	fuzziness              interface{}
	prefixLength           *int
	maxQueryTerms          *int
	ignoreTF               *bool
	analyzer               string
	failOnUnsupportedField *bool
	queryName              string
}

// NewFuzzyLikeThisFieldQuery creates a new fuzzy like this field query.
func NewFuzzyLikeThisFieldQuery(field string) FuzzyLikeThisFieldQuery {
	q := FuzzyLikeThisFieldQuery{
		field: field,
	}
	return q
}

func (q FuzzyLikeThisFieldQuery) LikeText(likeText string) FuzzyLikeThisFieldQuery {
	q.likeText = &likeText
	return q
}

// Fuzziness can be an integer/long like 0, 1 or 2 as well as strings like "auto",
// "0..1", "1..4" or "0.0..1.0".
func (q FuzzyLikeThisFieldQuery) Fuzziness(fuzziness interface{}) FuzzyLikeThisFieldQuery {
	q.fuzziness = fuzziness
	return q
}

func (q FuzzyLikeThisFieldQuery) PrefixLength(prefixLength int) FuzzyLikeThisFieldQuery {
	q.prefixLength = &prefixLength
	return q
}

func (q FuzzyLikeThisFieldQuery) MaxQueryTerms(maxQueryTerms int) FuzzyLikeThisFieldQuery {
	q.maxQueryTerms = &maxQueryTerms
	return q
}

func (q FuzzyLikeThisFieldQuery) IgnoreTF(ignoreTF bool) FuzzyLikeThisFieldQuery {
	q.ignoreTF = &ignoreTF
	return q
}

func (q FuzzyLikeThisFieldQuery) Analyzer(analyzer string) FuzzyLikeThisFieldQuery {
	q.analyzer = analyzer
	return q
}

func (q FuzzyLikeThisFieldQuery) Boost(boost float32) FuzzyLikeThisFieldQuery {
	q.boost = &boost
	return q
}

func (q FuzzyLikeThisFieldQuery) FailOnUnsupportedField(fail bool) FuzzyLikeThisFieldQuery {
	q.failOnUnsupportedField = &fail
	return q
}

func (q FuzzyLikeThisFieldQuery) QueryName(queryName string) FuzzyLikeThisFieldQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the ids query.
func (q FuzzyLikeThisFieldQuery) Source() interface{} {
	// {
	//	"fuzzy_like_this_field" : {
	//    "name.first": {
	//      "like_text" : "text like this one",
	//      "max_query_terms" : 12
	//    }
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["fuzzy_like_this_field"] = query
	fq := make(map[string]interface{})
	query[q.field] = fq

	fq["like_text"] = q.likeText

	if q.maxQueryTerms != nil {
		fq["max_query_terms"] = *q.maxQueryTerms
	}
	if q.fuzziness != nil {
		fq["fuzziness"] = q.fuzziness
	}
	if q.prefixLength != nil {
		fq["prefix_length"] = *q.prefixLength
	}
	if q.ignoreTF != nil {
		fq["ignore_tf"] = *q.ignoreTF
	}
	if q.boost != nil {
		fq["boost"] = *q.boost
	}
	if q.analyzer != "" {
		fq["analyzer"] = q.analyzer
	}
	if q.failOnUnsupportedField != nil {
		fq["fail_on_unsupported_field"] = *q.failOnUnsupportedField
	}
	if q.queryName != "" {
		fq["_name"] = q.queryName
	}

	return source
}

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// FuzzyLikeThisQuery finds documents that are "like" provided text by
// running it against one or more fields.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-flt-query.html
type FuzzyLikeThisQuery struct {
	Query

	fields                 []string
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

// NewFuzzyLikeThisQuery creates a new fuzzy query.
func NewFuzzyLikeThisQuery() FuzzyLikeThisQuery {
	q := FuzzyLikeThisQuery{
		fields: make([]string, 0),
	}
	return q
}

func (q FuzzyLikeThisQuery) Field(field string) FuzzyLikeThisQuery {
	q.fields = append(q.fields, field)
	return q
}

func (q FuzzyLikeThisQuery) Fields(fields ...string) FuzzyLikeThisQuery {
	q.fields = append(q.fields, fields...)
	return q
}

func (q FuzzyLikeThisQuery) LikeText(likeText string) FuzzyLikeThisQuery {
	q.likeText = &likeText
	return q
}

// Fuzziness can be an integer/long like 0, 1 or 2 as well as strings like "auto",
// "0..1", "1..4" or "0.0..1.0".
func (q FuzzyLikeThisQuery) Fuzziness(fuzziness interface{}) FuzzyLikeThisQuery {
	q.fuzziness = fuzziness
	return q
}

func (q FuzzyLikeThisQuery) PrefixLength(prefixLength int) FuzzyLikeThisQuery {
	q.prefixLength = &prefixLength
	return q
}

func (q FuzzyLikeThisQuery) MaxQueryTerms(maxQueryTerms int) FuzzyLikeThisQuery {
	q.maxQueryTerms = &maxQueryTerms
	return q
}

func (q FuzzyLikeThisQuery) IgnoreTF(ignoreTF bool) FuzzyLikeThisQuery {
	q.ignoreTF = &ignoreTF
	return q
}

func (q FuzzyLikeThisQuery) Analyzer(analyzer string) FuzzyLikeThisQuery {
	q.analyzer = analyzer
	return q
}

func (q FuzzyLikeThisQuery) Boost(boost float32) FuzzyLikeThisQuery {
	q.boost = &boost
	return q
}

func (q FuzzyLikeThisQuery) FailOnUnsupportedField(fail bool) FuzzyLikeThisQuery {
	q.failOnUnsupportedField = &fail
	return q
}

func (q FuzzyLikeThisQuery) QueryName(queryName string) FuzzyLikeThisQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the ids query.
func (q FuzzyLikeThisQuery) Source() interface{} {
	// {
	//	"fuzzy_like_this" : {
	//    "fields" : ["name.first", "name.last"],
	//    "like_text" : "text like this one",
	//    "max_query_terms" : 12
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["fuzzy_like_this"] = query

	if len(q.fields) > 0 {
		query["fields"] = q.fields
	}
	query["like_text"] = q.likeText

	if q.maxQueryTerms != nil {
		query["max_query_terms"] = *q.maxQueryTerms
	}
	if q.fuzziness != nil {
		query["fuzziness"] = q.fuzziness
	}
	if q.prefixLength != nil {
		query["prefix_length"] = *q.prefixLength
	}
	if q.ignoreTF != nil {
		query["ignore_tf"] = *q.ignoreTF
	}
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.analyzer != "" {
		query["analyzer"] = q.analyzer
	}
	if q.failOnUnsupportedField != nil {
		query["fail_on_unsupported_field"] = *q.failOnUnsupportedField
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}

	return source
}

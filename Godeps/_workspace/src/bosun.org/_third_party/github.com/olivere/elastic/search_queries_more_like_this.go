// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// More like this query find documents that are “like” provided text
// by running it against one or more fields. For more details, see
// http://www.elasticsearch.org/guide/reference/query-dsl/mlt-query/
type MoreLikeThisQuery struct {
	Query

	fields                 []string
	likeText               string
	percentTermsToMatch    *float32
	minTermFreq            *int
	maxQueryTerms          *int
	stopWords              []string
	minDocFreq             *int
	maxDocFreq             *int
	minWordLen             *int
	maxWordLen             *int
	boostTerms             *float32
	boost                  *float32
	analyzer               string
	failOnUnsupportedField *bool
}

// Creates a new mlt query.
func NewMoreLikeThisQuery(likeText string) MoreLikeThisQuery {
	q := MoreLikeThisQuery{
		likeText:  likeText,
		fields:    make([]string, 0),
		stopWords: make([]string, 0),
	}
	return q
}

func (q MoreLikeThisQuery) Field(field string) MoreLikeThisQuery {
	q.fields = append(q.fields, field)
	return q
}

func (q MoreLikeThisQuery) Fields(fields ...string) MoreLikeThisQuery {
	q.fields = append(q.fields, fields...)
	return q
}

func (q MoreLikeThisQuery) StopWord(stopWord string) MoreLikeThisQuery {
	q.stopWords = append(q.stopWords, stopWord)
	return q
}

func (q MoreLikeThisQuery) StopWords(stopWords ...string) MoreLikeThisQuery {
	q.stopWords = append(q.stopWords, stopWords...)
	return q
}

func (q MoreLikeThisQuery) LikeText(likeText string) MoreLikeThisQuery {
	q.likeText = likeText
	return q
}

func (q MoreLikeThisQuery) PercentTermsToMatch(percentTermsToMatch float32) MoreLikeThisQuery {
	q.percentTermsToMatch = &percentTermsToMatch
	return q
}

func (q MoreLikeThisQuery) MinTermFreq(minTermFreq int) MoreLikeThisQuery {
	q.minTermFreq = &minTermFreq
	return q
}

func (q MoreLikeThisQuery) MaxQueryTerms(maxQueryTerms int) MoreLikeThisQuery {
	q.maxQueryTerms = &maxQueryTerms
	return q
}

func (q MoreLikeThisQuery) MinDocFreq(minDocFreq int) MoreLikeThisQuery {
	q.minDocFreq = &minDocFreq
	return q
}

func (q MoreLikeThisQuery) MaxDocFreq(maxDocFreq int) MoreLikeThisQuery {
	q.maxDocFreq = &maxDocFreq
	return q
}

func (q MoreLikeThisQuery) MinWordLen(minWordLen int) MoreLikeThisQuery {
	q.minWordLen = &minWordLen
	return q
}

func (q MoreLikeThisQuery) MaxWordLen(maxWordLen int) MoreLikeThisQuery {
	q.maxWordLen = &maxWordLen
	return q
}

func (q MoreLikeThisQuery) BoostTerms(boostTerms float32) MoreLikeThisQuery {
	q.boostTerms = &boostTerms
	return q
}

func (q MoreLikeThisQuery) Analyzer(analyzer string) MoreLikeThisQuery {
	q.analyzer = analyzer
	return q
}

func (q MoreLikeThisQuery) Boost(boost float32) MoreLikeThisQuery {
	q.boost = &boost
	return q
}

func (q MoreLikeThisQuery) FailOnUnsupportedField(fail bool) MoreLikeThisQuery {
	q.failOnUnsupportedField = &fail
	return q
}

// Creates the query source for the mlt query.
func (q MoreLikeThisQuery) Source() interface{} {
	// {
	//   "match_all" : { ... }
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["more_like_this"] = params

	if len(q.fields) > 0 {
		params["fields"] = q.fields
	}

	params["like_text"] = q.likeText

	if q.percentTermsToMatch != nil {
		params["percent_terms_to_match"] = *q.percentTermsToMatch
	}

	if q.minTermFreq != nil {
		params["min_term_freq"] = *q.minTermFreq
	}

	if q.maxQueryTerms != nil {
		params["max_query_terms"] = *q.maxQueryTerms
	}

	if len(q.stopWords) > 0 {
		params["stop_words"] = q.stopWords
	}

	if q.minDocFreq != nil {
		params["min_doc_freq"] = *q.minDocFreq
	}

	if q.maxDocFreq != nil {
		params["max_doc_freq"] = *q.maxDocFreq
	}

	if q.minWordLen != nil {
		params["min_word_len"] = *q.minWordLen
	}

	if q.maxWordLen != nil {
		params["max_word_len"] = *q.maxWordLen
	}

	if q.boostTerms != nil {
		params["boost_terms"] = *q.boostTerms
	}

	if q.boost != nil {
		params["boost"] = *q.boost
	}

	if q.analyzer != "" {
		params["analyzer"] = q.analyzer
	}

	if q.failOnUnsupportedField != nil {
		params["fail_on_unsupported_field"] = *q.failOnUnsupportedField
	}
	return source
}

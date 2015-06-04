// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The more_like_this_field query is the same as the more_like_this query,
// except it runs against a single field. It provides nicer query DSL
// over the generic more_like_this query, and support typed fields query
// (automatically wraps typed fields with type filter to match only
// on the specific type).
//
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/mlt-field-query/
type MoreLikeThisFieldQuery struct {
	Query

	name                   string
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

// Creates a new mlt_field query.
func NewMoreLikeThisFieldQuery(name, likeText string) MoreLikeThisFieldQuery {
	q := MoreLikeThisFieldQuery{
		name:      name,
		likeText:  likeText,
		stopWords: make([]string, 0),
	}
	return q
}

func (q MoreLikeThisFieldQuery) Name(name string) MoreLikeThisFieldQuery {
	q.name = name
	return q
}

func (q MoreLikeThisFieldQuery) StopWord(stopWord string) MoreLikeThisFieldQuery {
	q.stopWords = append(q.stopWords, stopWord)
	return q
}

func (q MoreLikeThisFieldQuery) StopWords(stopWords ...string) MoreLikeThisFieldQuery {
	q.stopWords = append(q.stopWords, stopWords...)
	return q
}

func (q MoreLikeThisFieldQuery) LikeText(likeText string) MoreLikeThisFieldQuery {
	q.likeText = likeText
	return q
}

func (q MoreLikeThisFieldQuery) PercentTermsToMatch(percentTermsToMatch float32) MoreLikeThisFieldQuery {
	q.percentTermsToMatch = &percentTermsToMatch
	return q
}

func (q MoreLikeThisFieldQuery) MinTermFreq(minTermFreq int) MoreLikeThisFieldQuery {
	q.minTermFreq = &minTermFreq
	return q
}

func (q MoreLikeThisFieldQuery) MaxQueryTerms(maxQueryTerms int) MoreLikeThisFieldQuery {
	q.maxQueryTerms = &maxQueryTerms
	return q
}

func (q MoreLikeThisFieldQuery) MinDocFreq(minDocFreq int) MoreLikeThisFieldQuery {
	q.minDocFreq = &minDocFreq
	return q
}

func (q MoreLikeThisFieldQuery) MaxDocFreq(maxDocFreq int) MoreLikeThisFieldQuery {
	q.maxDocFreq = &maxDocFreq
	return q
}

func (q MoreLikeThisFieldQuery) MinWordLen(minWordLen int) MoreLikeThisFieldQuery {
	q.minWordLen = &minWordLen
	return q
}

func (q MoreLikeThisFieldQuery) MaxWordLen(maxWordLen int) MoreLikeThisFieldQuery {
	q.maxWordLen = &maxWordLen
	return q
}

func (q MoreLikeThisFieldQuery) BoostTerms(boostTerms float32) MoreLikeThisFieldQuery {
	q.boostTerms = &boostTerms
	return q
}

func (q MoreLikeThisFieldQuery) Analyzer(analyzer string) MoreLikeThisFieldQuery {
	q.analyzer = analyzer
	return q
}

func (q MoreLikeThisFieldQuery) Boost(boost float32) MoreLikeThisFieldQuery {
	q.boost = &boost
	return q
}

func (q MoreLikeThisFieldQuery) FailOnUnsupportedField(fail bool) MoreLikeThisFieldQuery {
	q.failOnUnsupportedField = &fail
	return q
}

// Creates the query source for the mlt query.
func (q MoreLikeThisFieldQuery) Source() interface{} {
	// {
	//     "more_like_this_field" : {
	//         "name.first" : {
	//             "like_text" : "text like this one",
	//             "min_term_freq" : 1,
	//             "max_query_terms" : 12
	//         }
	//     }
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["more_like_this_field"] = params

	mlt := make(map[string]interface{})
	params[q.name] = mlt

	mlt["like_text"] = q.likeText

	if q.percentTermsToMatch != nil {
		mlt["percent_terms_to_match"] = *q.percentTermsToMatch
	}

	if q.minTermFreq != nil {
		mlt["min_term_freq"] = *q.minTermFreq
	}

	if q.maxQueryTerms != nil {
		mlt["max_query_terms"] = *q.maxQueryTerms
	}

	if len(q.stopWords) > 0 {
		mlt["stop_words"] = q.stopWords
	}

	if q.minDocFreq != nil {
		mlt["min_doc_freq"] = *q.minDocFreq
	}

	if q.maxDocFreq != nil {
		mlt["max_doc_freq"] = *q.maxDocFreq
	}

	if q.minWordLen != nil {
		mlt["min_word_len"] = *q.minWordLen
	}

	if q.maxWordLen != nil {
		mlt["max_word_len"] = *q.maxWordLen
	}

	if q.boostTerms != nil {
		mlt["boost_terms"] = *q.boostTerms
	}

	if q.boost != nil {
		mlt["boost"] = *q.boost
	}

	if q.analyzer != "" {
		mlt["analyzer"] = q.analyzer
	}

	if q.failOnUnsupportedField != nil {
		mlt["fail_on_unsupported_field"] = *q.failOnUnsupportedField
	}
	return source
}

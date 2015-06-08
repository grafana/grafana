// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// FuzzyFuzzyCompletionSuggester is a FuzzyCompletionSuggester that allows fuzzy
// completion.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters-completion.html
// for details, and
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters-completion.html#fuzzy
// for details about the fuzzy completion suggester.
type FuzzyCompletionSuggester struct {
	Suggester
	name           string
	text           string
	field          string
	analyzer       string
	size           *int
	shardSize      *int
	contextQueries []SuggesterContextQuery

	fuzziness           interface{}
	fuzzyTranspositions *bool
	fuzzyMinLength      *int
	fuzzyPrefixLength   *int
	unicodeAware        *bool
}

// Creates a new completion suggester.
func NewFuzzyCompletionSuggester(name string) FuzzyCompletionSuggester {
	return FuzzyCompletionSuggester{
		name:           name,
		contextQueries: make([]SuggesterContextQuery, 0),
	}
}

func (q FuzzyCompletionSuggester) Name() string {
	return q.name
}

func (q FuzzyCompletionSuggester) Text(text string) FuzzyCompletionSuggester {
	q.text = text
	return q
}

func (q FuzzyCompletionSuggester) Field(field string) FuzzyCompletionSuggester {
	q.field = field
	return q
}

func (q FuzzyCompletionSuggester) Analyzer(analyzer string) FuzzyCompletionSuggester {
	q.analyzer = analyzer
	return q
}

func (q FuzzyCompletionSuggester) Size(size int) FuzzyCompletionSuggester {
	q.size = &size
	return q
}

func (q FuzzyCompletionSuggester) ShardSize(shardSize int) FuzzyCompletionSuggester {
	q.shardSize = &shardSize
	return q
}

func (q FuzzyCompletionSuggester) ContextQuery(query SuggesterContextQuery) FuzzyCompletionSuggester {
	q.contextQueries = append(q.contextQueries, query)
	return q
}

func (q FuzzyCompletionSuggester) ContextQueries(queries ...SuggesterContextQuery) FuzzyCompletionSuggester {
	q.contextQueries = append(q.contextQueries, queries...)
	return q
}

// Fuzziness defines the strategy used to describe what "fuzzy" actually
// means for the suggester, e.g. 1, 2, "0", "1..2", ">4", or "AUTO".
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/common-options.html#fuzziness
// for a detailed description.
func (q FuzzyCompletionSuggester) Fuzziness(fuzziness interface{}) FuzzyCompletionSuggester {
	q.fuzziness = fuzziness
	return q
}

func (q FuzzyCompletionSuggester) FuzzyTranspositions(fuzzyTranspositions bool) FuzzyCompletionSuggester {
	q.fuzzyTranspositions = &fuzzyTranspositions
	return q
}

func (q FuzzyCompletionSuggester) FuzzyMinLength(minLength int) FuzzyCompletionSuggester {
	q.fuzzyMinLength = &minLength
	return q
}

func (q FuzzyCompletionSuggester) FuzzyPrefixLength(prefixLength int) FuzzyCompletionSuggester {
	q.fuzzyPrefixLength = &prefixLength
	return q
}

func (q FuzzyCompletionSuggester) UnicodeAware(unicodeAware bool) FuzzyCompletionSuggester {
	q.unicodeAware = &unicodeAware
	return q
}

// Creates the source for the completion suggester.
func (q FuzzyCompletionSuggester) Source(includeName bool) interface{} {
	cs := &completionSuggesterRequest{}

	if q.text != "" {
		cs.Text = q.text
	}

	suggester := make(map[string]interface{})
	cs.Completion = suggester

	if q.analyzer != "" {
		suggester["analyzer"] = q.analyzer
	}
	if q.field != "" {
		suggester["field"] = q.field
	}
	if q.size != nil {
		suggester["size"] = *q.size
	}
	if q.shardSize != nil {
		suggester["shard_size"] = *q.shardSize
	}
	switch len(q.contextQueries) {
	case 0:
	case 1:
		suggester["context"] = q.contextQueries[0].Source()
	default:
		ctxq := make([]interface{}, 0)
		for _, query := range q.contextQueries {
			ctxq = append(ctxq, query.Source())
		}
		suggester["context"] = ctxq
	}

	// Fuzzy Completion Suggester fields
	if q.fuzziness != nil {
		suggester["fuzziness"] = q.fuzziness
	}
	if q.fuzzyTranspositions != nil {
		suggester["transpositions"] = *q.fuzzyTranspositions
	}
	if q.fuzzyMinLength != nil {
		suggester["min_length"] = *q.fuzzyMinLength
	}
	if q.fuzzyPrefixLength != nil {
		suggester["prefix_length"] = *q.fuzzyPrefixLength
	}
	if q.unicodeAware != nil {
		suggester["unicode_aware"] = *q.unicodeAware
	}

	if !includeName {
		return cs
	}

	source := make(map[string]interface{})
	source[q.name] = cs
	return source
}

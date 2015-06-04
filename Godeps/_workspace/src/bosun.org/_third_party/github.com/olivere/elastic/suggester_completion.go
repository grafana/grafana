// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// CompletionSuggester is a fast suggester for e.g. type-ahead completion.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-suggesters-completion.html
// for more details.
type CompletionSuggester struct {
	Suggester
	name           string
	text           string
	field          string
	analyzer       string
	size           *int
	shardSize      *int
	contextQueries []SuggesterContextQuery
}

// Creates a new completion suggester.
func NewCompletionSuggester(name string) CompletionSuggester {
	return CompletionSuggester{
		name:           name,
		contextQueries: make([]SuggesterContextQuery, 0),
	}
}

func (q CompletionSuggester) Name() string {
	return q.name
}

func (q CompletionSuggester) Text(text string) CompletionSuggester {
	q.text = text
	return q
}

func (q CompletionSuggester) Field(field string) CompletionSuggester {
	q.field = field
	return q
}

func (q CompletionSuggester) Analyzer(analyzer string) CompletionSuggester {
	q.analyzer = analyzer
	return q
}

func (q CompletionSuggester) Size(size int) CompletionSuggester {
	q.size = &size
	return q
}

func (q CompletionSuggester) ShardSize(shardSize int) CompletionSuggester {
	q.shardSize = &shardSize
	return q
}

func (q CompletionSuggester) ContextQuery(query SuggesterContextQuery) CompletionSuggester {
	q.contextQueries = append(q.contextQueries, query)
	return q
}

func (q CompletionSuggester) ContextQueries(queries ...SuggesterContextQuery) CompletionSuggester {
	q.contextQueries = append(q.contextQueries, queries...)
	return q
}

// completionSuggesterRequest is necessary because the order in which
// the JSON elements are routed to Elasticsearch is relevant.
// We got into trouble when using plain maps because the text element
// needs to go before the completion element.
type completionSuggesterRequest struct {
	Text       string      `json:"text"`
	Completion interface{} `json:"completion"`
}

// Creates the source for the completion suggester.
func (q CompletionSuggester) Source(includeName bool) interface{} {
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

	// TODO(oe) Add competion-suggester specific parameters here

	if !includeName {
		return cs
	}

	source := make(map[string]interface{})
	source[q.name] = cs
	return source
}

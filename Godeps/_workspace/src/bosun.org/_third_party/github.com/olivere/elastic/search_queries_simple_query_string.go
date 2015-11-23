// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"strings"
)

// SimpleQueryStringQuery is a query that uses the SimpleQueryParser
// to parse its context. Unlike the regular query_string query,
// the simple_query_string query will never throw an exception,
// and discards invalid parts of the query.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-simple-query-string-query.html
type SimpleQueryStringQuery struct {
	queryText   string
	analyzer    string
	operator    string
	fields      []string
	fieldBoosts map[string]*float32
}

// Creates a new simple query string query.
func NewSimpleQueryStringQuery(text string) SimpleQueryStringQuery {
	q := SimpleQueryStringQuery{
		queryText:   text,
		fields:      make([]string, 0),
		fieldBoosts: make(map[string]*float32),
	}
	return q
}

func (q SimpleQueryStringQuery) Field(field string) SimpleQueryStringQuery {
	q.fields = append(q.fields, field)
	return q
}

func (q SimpleQueryStringQuery) FieldWithBoost(field string, boost float32) SimpleQueryStringQuery {
	q.fields = append(q.fields, field)
	q.fieldBoosts[field] = &boost
	return q
}

func (q SimpleQueryStringQuery) Analyzer(analyzer string) SimpleQueryStringQuery {
	q.analyzer = analyzer
	return q
}

func (q SimpleQueryStringQuery) DefaultOperator(defaultOperator string) SimpleQueryStringQuery {
	q.operator = defaultOperator
	return q
}

// Creates the query source for the query string query.
func (q SimpleQueryStringQuery) Source() interface{} {
	// {
	//    "simple_query_string" : {
	//      "query" : "\"fried eggs\" +(eggplant | potato) -frittata",
	//			"analyzer" : "snowball",
	//      "fields" : ["body^5","_all"],
	//      "default_operator" : "and"
	//    }
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["simple_query_string"] = query

	query["query"] = q.queryText

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

	if q.analyzer != "" {
		query["analyzer"] = q.analyzer
	}

	if q.operator != "" {
		query["default_operator"] = strings.ToLower(q.operator)
	}

	return source
}

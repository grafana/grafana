// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents that only have the provided ids.
// Note, this filter does not require the _id field to be indexed
// since it works using the _uid field.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-ids-query.html
type IdsQuery struct {
	Query
	types     []string
	values    []string
	boost     float32
	queryName string
}

// NewIdsQuery creates a new ids query.
func NewIdsQuery(types ...string) IdsQuery {
	q := IdsQuery{
		types:  types,
		values: make([]string, 0),
		boost:  -1.0,
	}
	return q
}

func (q IdsQuery) Ids(ids ...string) IdsQuery {
	q.values = append(q.values, ids...)
	return q
}

func (q IdsQuery) Boost(boost float32) IdsQuery {
	q.boost = boost
	return q
}

func (q IdsQuery) QueryName(queryName string) IdsQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the ids query.
func (q IdsQuery) Source() interface{} {
	// {
	//	"ids" : {
	//		"type" : "my_type",
	//		"values" : ["1", "4", "100"]
	//	}
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["ids"] = query

	// type(s)
	if len(q.types) == 1 {
		query["type"] = q.types[0]
	} else if len(q.types) > 1 {
		query["types"] = q.types
	}

	// values
	query["values"] = q.values

	if q.boost != -1.0 {
		query["boost"] = q.boost
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}

	return source
}

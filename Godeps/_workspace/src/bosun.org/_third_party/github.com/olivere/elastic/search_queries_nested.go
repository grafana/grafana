// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Nested query allows to query nested objects / docs (see nested mapping).
// The query is executed against the nested objects / docs as if they were
// indexed as separate docs (they are, internally) and resulting in the
// root parent doc (or parent nested mapping).
//
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/nested-query/
type NestedQuery struct {
	query     Query
	filter    Filter
	path      string
	scoreMode string
	boost     *float32
	queryName string
}

// Creates a new nested_query query.
func NewNestedQuery(path string) NestedQuery {
	return NestedQuery{path: path}
}

func (q NestedQuery) Query(query Query) NestedQuery {
	q.query = query
	return q
}

func (q NestedQuery) Filter(filter Filter) NestedQuery {
	q.filter = filter
	return q
}

func (q NestedQuery) Path(path string) NestedQuery {
	q.path = path
	return q
}

func (q NestedQuery) ScoreMode(scoreMode string) NestedQuery {
	q.scoreMode = scoreMode
	return q
}

func (q NestedQuery) Boost(boost float32) NestedQuery {
	q.boost = &boost
	return q
}

func (q NestedQuery) QueryName(queryName string) NestedQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the nested_query query.
func (q NestedQuery) Source() interface{} {
	// {
	//   "nested" : {
	//     "query" : {
	//       "bool" : {
	//         "must" : [
	//           {
	//             "match" : {"obj1.name" : "blue"}
	//           },
	//           {
	//             "range" : {"obj1.count" : {"gt" : 5}}
	//           }
	//         ]
	//       }
	//     },
	//     "filter" : {
	//       ...
	//     },
	//     "path" : "obj1",
	//     "score_mode" : "avg",
	//     "boost" : 1.0
	//   }
	// }

	query := make(map[string]interface{})

	nq := make(map[string]interface{})
	query["nested"] = nq
	if q.query != nil {
		nq["query"] = q.query.Source()
	}
	if q.filter != nil {
		nq["filter"] = q.filter.Source()
	}
	nq["path"] = q.path
	if q.scoreMode != "" {
		nq["score_mode"] = q.scoreMode
	}
	if q.boost != nil {
		nq["boost"] = *q.boost
	}
	if q.queryName != "" {
		nq["_name"] = q.queryName
	}
	return query
}

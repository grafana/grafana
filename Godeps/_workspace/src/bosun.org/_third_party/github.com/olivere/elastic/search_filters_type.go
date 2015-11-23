// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents matching the provided document / mapping type.
// Note, this filter can work even when the _type field is not indexed
// (using the _uid field).
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-type-filter.html
type TypeFilter struct {
	Filter
	typ string
}

func NewTypeFilter(typ string) TypeFilter {
	f := TypeFilter{typ: typ}
	return f
}

func (f TypeFilter) Source() interface{} {
	// {
	//   "type" : {
	//     "value" : "..."
	//   }
	// }
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["type"] = params
	params["value"] = f.typ
	return source
}

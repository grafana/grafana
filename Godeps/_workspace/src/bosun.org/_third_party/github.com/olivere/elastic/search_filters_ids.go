// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents that only have the provided ids.
// Note, this filter does not require the _id field to be indexed
// since it works using the _uid field.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-ids-filter.html
type IdsFilter struct {
	Filter
	types      []string
	values     []string
	filterName string
}

func NewIdsFilter(types ...string) IdsFilter {
	return IdsFilter{
		types:  types,
		values: make([]string, 0),
	}
}

func (f IdsFilter) Ids(ids ...string) IdsFilter {
	f.values = append(f.values, ids...)
	return f
}

func (f IdsFilter) FilterName(filterName string) IdsFilter {
	f.filterName = filterName
	return f
}

func (f IdsFilter) Source() interface{} {
	// {
	//	"ids" : {
	//		"type" : "my_type",
	//		"values" : ["1", "4", "100"]
	//	}
	// }
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["ids"] = params

	// type(s)
	if len(f.types) == 1 {
		params["type"] = f.types[0]
	} else if len(f.types) > 1 {
		params["types"] = f.types
	}

	// values
	params["values"] = f.values

	// filter name
	if f.filterName != "" {
		params["_name"] = f.filterName
	}

	return source
}

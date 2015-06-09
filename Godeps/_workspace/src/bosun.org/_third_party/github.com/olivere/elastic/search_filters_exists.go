// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents where a specific field has a value in them.
// For details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/exists-filter.html
type ExistsFilter struct {
	Filter
	name       string
	filterName string
}

func NewExistsFilter(name string) ExistsFilter {
	f := ExistsFilter{name: name}
	return f
}

func (f ExistsFilter) FilterName(filterName string) ExistsFilter {
	f.filterName = filterName
	return f
}

func (f ExistsFilter) Source() interface{} {
	// {
	//   "exists" : {
	//     "field" : "..."
	//   }
	// }

	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["exists"] = params
	params["field"] = f.name
	if f.filterName != "" {
		params["_name"] = f.filterName
	}
	return source
}

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Filters documents where a specific field has no value in them.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-missing-filter.html
type MissingFilter struct {
	Filter
	name       string
	filterName string
	nullValue  *bool
	existence  *bool
}

func NewMissingFilter(name string) MissingFilter {
	f := MissingFilter{name: name}
	return f
}

func (f MissingFilter) FilterName(filterName string) MissingFilter {
	f.filterName = filterName
	return f
}

func (f MissingFilter) NullValue(nullValue bool) MissingFilter {
	f.nullValue = &nullValue
	return f
}

func (f MissingFilter) Existence(existence bool) MissingFilter {
	f.existence = &existence
	return f
}

func (f MissingFilter) Source() interface{} {
	// {
	//   "missing" : {
	//     "field" : "..."
	//   }
	// }

	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["missing"] = params
	params["field"] = f.name
	if f.nullValue != nil {
		params["null_value"] = *f.nullValue
	}
	if f.existence != nil {
		params["existence"] = *f.existence
	}
	if f.filterName != "" {
		params["_name"] = f.filterName
	}
	return source
}

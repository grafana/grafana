// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Query Facet
// See: http://www.elasticsearch.org/guide/reference/api/search/facets/query-facet.html
type QueryFacet struct {
	facetFilter Filter
	global      *bool
	nested      string
	mode        string
	query       Query
}

func NewQueryFacet() QueryFacet {
	return QueryFacet{}
}

func (f QueryFacet) FacetFilter(filter Facet) QueryFacet {
	f.facetFilter = filter
	return f
}

func (f QueryFacet) Global(global bool) QueryFacet {
	f.global = &global
	return f
}

func (f QueryFacet) Nested(nested string) QueryFacet {
	f.nested = nested
	return f
}

func (f QueryFacet) Mode(mode string) QueryFacet {
	f.mode = mode
	return f
}

func (f QueryFacet) Query(query Query) QueryFacet {
	f.query = query
	return f
}

func (f QueryFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
	if f.facetFilter != nil {
		source["facet_filter"] = f.facetFilter.Source()
	}
	if f.nested != "" {
		source["nested"] = f.nested
	}
	if f.global != nil {
		source["global"] = *f.global
	}
	if f.mode != "" {
		source["mode"] = f.mode
	}
}

func (f QueryFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	source["query"] = f.query.Source()
	return source
}

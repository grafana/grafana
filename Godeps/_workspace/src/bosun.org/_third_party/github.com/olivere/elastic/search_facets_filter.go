// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A filter facet (not to be confused with a facet filter) allows you
// to return a count of the hits matching the filter.
// The filter itself can be expressed using the Query DSL.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-filter-facet.html
type FilterFacet struct {
	facetFilter Filter
	global      *bool
	nested      string
	mode        string
	filter      Filter
}

func NewFilterFacet() FilterFacet {
	return FilterFacet{}
}

func (f FilterFacet) FacetFilter(filter Facet) FilterFacet {
	f.facetFilter = filter
	return f
}

func (f FilterFacet) Global(global bool) FilterFacet {
	f.global = &global
	return f
}

func (f FilterFacet) Nested(nested string) FilterFacet {
	f.nested = nested
	return f
}

func (f FilterFacet) Mode(mode string) FilterFacet {
	f.mode = mode
	return f
}

func (f FilterFacet) Filter(filter Filter) FilterFacet {
	f.filter = filter
	return f
}

func (f FilterFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f FilterFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	source["filter"] = f.filter.Source()
	return source
}

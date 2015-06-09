// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Statistical facet allows to compute statistical data on a numeric fields.
// The statistical data include count, total, sum of squares, mean (average),
// minimum, maximum, variance, and standard deviation.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-statistical-facet.html
type StatisticalFacet struct {
	facetFilter Filter
	global      *bool
	nested      string
	mode        string
	fieldName   string
	fieldNames  []string
}

func NewStatisticalFacet() StatisticalFacet {
	return StatisticalFacet{
		fieldNames: make([]string, 0),
	}
}

func (f StatisticalFacet) FacetFilter(filter Facet) StatisticalFacet {
	f.facetFilter = filter
	return f
}

func (f StatisticalFacet) Global(global bool) StatisticalFacet {
	f.global = &global
	return f
}

func (f StatisticalFacet) Nested(nested string) StatisticalFacet {
	f.nested = nested
	return f
}

func (f StatisticalFacet) Mode(mode string) StatisticalFacet {
	f.mode = mode
	return f
}

func (f StatisticalFacet) Field(fieldName string) StatisticalFacet {
	f.fieldName = fieldName
	return f
}

func (f StatisticalFacet) Fields(fieldNames ...string) StatisticalFacet {
	f.fieldNames = append(f.fieldNames, fieldNames...)
	return f
}

func (f StatisticalFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f StatisticalFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["statistical"] = opts

	if len(f.fieldNames) > 0 {
		if len(f.fieldNames) == 1 {
			opts["field"] = f.fieldNames[0]
		} else {
			opts["fields"] = f.fieldNames
		}
	} else {
		opts["field"] = f.fieldName
	}

	return source
}

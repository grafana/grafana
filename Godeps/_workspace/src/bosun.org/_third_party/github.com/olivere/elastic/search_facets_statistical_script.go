// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Statistical facet allows to compute statistical data on a numeric fields.
// The statistical data include count, total, sum of squares, mean (average),
// minimum, maximum, variance, and standard deviation.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-statistical-facet.html
type StatisticalScriptFacet struct {
	facetFilter Filter
	global      *bool
	nested      string
	mode        string
	lang        string
	script      string
	params      map[string]interface{}
}

func NewStatisticalScriptFacet() StatisticalScriptFacet {
	return StatisticalScriptFacet{
		params: make(map[string]interface{}),
	}
}

func (f StatisticalScriptFacet) FacetFilter(filter Facet) StatisticalScriptFacet {
	f.facetFilter = filter
	return f
}

func (f StatisticalScriptFacet) Global(global bool) StatisticalScriptFacet {
	f.global = &global
	return f
}

func (f StatisticalScriptFacet) Nested(nested string) StatisticalScriptFacet {
	f.nested = nested
	return f
}

func (f StatisticalScriptFacet) Mode(mode string) StatisticalScriptFacet {
	f.mode = mode
	return f
}

func (f StatisticalScriptFacet) Lang(lang string) StatisticalScriptFacet {
	f.lang = lang
	return f
}

func (f StatisticalScriptFacet) Script(script string) StatisticalScriptFacet {
	f.script = script
	return f
}

func (f StatisticalScriptFacet) Param(name string, value interface{}) StatisticalScriptFacet {
	f.params[name] = value
	return f
}

func (f StatisticalScriptFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f StatisticalScriptFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["statistical"] = opts

	opts["script"] = f.script
	if f.lang != "" {
		opts["lang"] = f.lang
	}
	if len(f.params) > 0 {
		opts["params"] = f.params
	}

	return source
}

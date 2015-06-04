// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Histogram Facet
// See: http://www.elasticsearch.org/guide/reference/api/search/facets/histogram-facet.html
type HistogramScriptFacet struct {
	facetFilter    Filter
	global         *bool
	nested         string
	mode           string
	lang           string
	keyField       string
	keyScript      string
	valueScript    string
	params         map[string]interface{}
	interval       int64
	comparatorType string
}

func NewHistogramScriptFacet() HistogramScriptFacet {
	return HistogramScriptFacet{
		interval: -1,
		params:   make(map[string]interface{}),
	}
}

func (f HistogramScriptFacet) FacetFilter(filter Facet) HistogramScriptFacet {
	f.facetFilter = filter
	return f
}

func (f HistogramScriptFacet) Global(global bool) HistogramScriptFacet {
	f.global = &global
	return f
}

func (f HistogramScriptFacet) Nested(nested string) HistogramScriptFacet {
	f.nested = nested
	return f
}

func (f HistogramScriptFacet) Mode(mode string) HistogramScriptFacet {
	f.mode = mode
	return f
}

func (f HistogramScriptFacet) KeyField(keyField string) HistogramScriptFacet {
	f.keyField = keyField
	return f
}

func (f HistogramScriptFacet) KeyScript(keyScript string) HistogramScriptFacet {
	f.keyScript = keyScript
	return f
}

func (f HistogramScriptFacet) ValueScript(valueScript string) HistogramScriptFacet {
	f.valueScript = valueScript
	return f
}

func (f HistogramScriptFacet) Interval(interval int64) HistogramScriptFacet {
	f.interval = interval
	return f
}

func (f HistogramScriptFacet) Param(name string, value interface{}) HistogramScriptFacet {
	f.params[name] = value
	return f
}

func (f HistogramScriptFacet) Comparator(comparatorType string) HistogramScriptFacet {
	f.comparatorType = comparatorType
	return f
}

func (f HistogramScriptFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f HistogramScriptFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["histogram"] = opts

	if f.keyField != "" {
		opts["key_field"] = f.keyField
	} else if f.keyScript != "" {
		opts["key_script"] = f.keyScript
	}
	opts["value_script"] = f.valueScript
	if f.lang != "" {
		opts["lang"] = f.lang
	}
	if f.interval > 0 {
		opts["interval"] = f.interval
	}
	if len(f.params) > 0 {
		opts["params"] = f.params
	}
	if f.comparatorType != "" {
		opts["comparator"] = f.comparatorType
	}
	return source
}

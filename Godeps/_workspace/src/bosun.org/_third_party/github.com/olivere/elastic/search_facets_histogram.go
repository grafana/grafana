// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Histogram Facet
// See: http://www.elasticsearch.org/guide/reference/api/search/facets/histogram-facet.html
type HistogramFacet struct {
	facetFilter    Filter
	global         *bool
	nested         string
	mode           string
	keyField       string
	valueField     string
	interval       int64
	timeInterval   string
	comparatorType string
}

func NewHistogramFacet() HistogramFacet {
	return HistogramFacet{
		interval: -1,
	}
}

func (f HistogramFacet) FacetFilter(filter Facet) HistogramFacet {
	f.facetFilter = filter
	return f
}

func (f HistogramFacet) Global(global bool) HistogramFacet {
	f.global = &global
	return f
}

func (f HistogramFacet) Nested(nested string) HistogramFacet {
	f.nested = nested
	return f
}

func (f HistogramFacet) Mode(mode string) HistogramFacet {
	f.mode = mode
	return f
}

func (f HistogramFacet) Field(field string) HistogramFacet {
	f.keyField = field
	return f
}

func (f HistogramFacet) KeyField(keyField string) HistogramFacet {
	f.keyField = keyField
	return f
}

func (f HistogramFacet) ValueField(valueField string) HistogramFacet {
	f.valueField = valueField
	return f
}

func (f HistogramFacet) Interval(interval int64) HistogramFacet {
	f.interval = interval
	return f
}

func (f HistogramFacet) TimeInterval(timeInterval string) HistogramFacet {
	f.timeInterval = timeInterval
	return f
}

func (f HistogramFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f HistogramFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["histogram"] = opts

	if f.valueField != "" {
		opts["key_field"] = f.keyField
		opts["value_field"] = f.valueField
	} else {
		opts["field"] = f.keyField
	}
	if f.timeInterval != "" {
		opts["time_interval"] = f.timeInterval
	} else {
		opts["interval"] = f.interval
	}

	if f.comparatorType != "" {
		opts["comparator"] = f.comparatorType
	}

	return source
}

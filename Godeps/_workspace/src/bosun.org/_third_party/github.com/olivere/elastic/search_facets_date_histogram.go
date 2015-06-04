// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A specific histogram facet that can work with date field types
// enhancing it over the regular histogram facet.
// See:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-date-histogram-facet.html
type DateHistogramFacet struct {
	facetFilter                Filter
	global                     *bool
	nested                     string
	mode                       string
	keyField                   string
	valueField                 *string
	interval                   string
	preZone                    string
	preZoneAdjustLargeInterval *bool
	postZone                   string
	preOffset                  string
	postOffset                 string
	factor                     *float32
	comparatorType             string
	valueScript                string
	params                     map[string]interface{}
	lang                       string
}

func NewDateHistogramFacet() DateHistogramFacet {
	return DateHistogramFacet{
		params: make(map[string]interface{}),
	}
}

func (f DateHistogramFacet) FacetFilter(filter Facet) DateHistogramFacet {
	f.facetFilter = filter
	return f
}

func (f DateHistogramFacet) Global(global bool) DateHistogramFacet {
	f.global = &global
	return f
}

func (f DateHistogramFacet) Nested(nested string) DateHistogramFacet {
	f.nested = nested
	return f
}

func (f DateHistogramFacet) Mode(mode string) DateHistogramFacet {
	f.mode = mode
	return f
}

func (f DateHistogramFacet) Field(field string) DateHistogramFacet {
	f.keyField = field
	return f
}

func (f DateHistogramFacet) KeyField(keyField string) DateHistogramFacet {
	f.keyField = keyField
	return f
}

func (f DateHistogramFacet) ValueField(valueField string) DateHistogramFacet {
	f.valueField = &valueField
	return f
}

func (f DateHistogramFacet) ValueScript(valueScript string) DateHistogramFacet {
	f.valueScript = valueScript
	return f
}

func (f DateHistogramFacet) Param(name string, value interface{}) DateHistogramFacet {
	f.params[name] = value
	return f
}

func (f DateHistogramFacet) Lang(lang string) DateHistogramFacet {
	f.lang = lang
	return f
}

// Allowed values are: "year", "quarter", "month", "week", "day",
// "hour", "minute". It also supports time settings like "1.5h"
// (up to "w" for weeks).
func (f DateHistogramFacet) Interval(interval string) DateHistogramFacet {
	f.interval = interval
	return f
}

func (f DateHistogramFacet) PreZoneAdjustLargeInterval(preZoneAdjustLargeInterval bool) DateHistogramFacet {
	f.preZoneAdjustLargeInterval = &preZoneAdjustLargeInterval
	return f
}

func (f DateHistogramFacet) PreZone(preZone string) DateHistogramFacet {
	f.preZone = preZone
	return f
}

func (f DateHistogramFacet) PostZone(postZone string) DateHistogramFacet {
	f.postZone = postZone
	return f
}

func (f DateHistogramFacet) PreOffset(preOffset string) DateHistogramFacet {
	f.preOffset = preOffset
	return f
}

func (f DateHistogramFacet) PostOffset(postOffset string) DateHistogramFacet {
	f.postOffset = postOffset
	return f
}

func (f DateHistogramFacet) Factor(factor float32) DateHistogramFacet {
	f.factor = &factor
	return f
}

func (f DateHistogramFacet) Comparator(comparator string) DateHistogramFacet {
	f.comparatorType = comparator
	return f
}

func (f DateHistogramFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f DateHistogramFacet) Source() interface{} {
	/*
			"histo1" : {
		    "date_histogram" : {
		        "field" : "field_name",
		        "interval" : "day"
		    }
		  }
	*/
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	facet := make(map[string]interface{})
	source["date_histogram"] = facet

	if f.valueField != nil {
		facet["key_field"] = f.keyField
		facet["value_field"] = *f.valueField
	} else {
		facet["field"] = f.keyField
	}

	if f.valueScript != "" {
		facet["value_script"] = f.valueScript
		if f.lang != "" {
			facet["lang"] = f.lang
		}
		if len(f.params) > 0 {
			facet["params"] = f.params
		}
	}
	facet["interval"] = f.interval
	if f.preZone != "" {
		facet["pre_zone"] = f.preZone
	}
	if f.preZoneAdjustLargeInterval != nil {
		facet["pre_zone_adjust_large_interval"] = *f.preZoneAdjustLargeInterval
	}
	if f.postZone != "" {
		facet["post_zone"] = f.postZone
	}
	if f.preOffset != "" {
		facet["pre_offset"] = f.preOffset
	}
	if f.postOffset != "" {
		facet["post_offset"] = f.postOffset
	}
	if f.factor != nil {
		facet["factor"] = *f.factor
	}
	if f.comparatorType != "" {
		facet["comparator"] = f.comparatorType
	}
	return source
}

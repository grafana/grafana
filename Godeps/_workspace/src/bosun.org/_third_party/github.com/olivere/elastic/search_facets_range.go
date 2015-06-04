// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"time"
)

// Range facet allows to specify a set of ranges and get both the
// number of docs (count) that fall within each range,
// and aggregated data either based on the field, or using another field.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-range-facet.html
type RangeFacet struct {
	facetFilter Filter
	global      *bool
	nested      string
	mode        string
	keyField    string
	valueField  string
	entries     []rangeFacetEntry
}

type rangeFacetEntry struct {
	From interface{}
	To   interface{}
}

func NewRangeFacet() RangeFacet {
	return RangeFacet{
		entries: make([]rangeFacetEntry, 0),
	}
}

func (f RangeFacet) FacetFilter(filter Facet) RangeFacet {
	f.facetFilter = filter
	return f
}

func (f RangeFacet) Global(global bool) RangeFacet {
	f.global = &global
	return f
}

func (f RangeFacet) Nested(nested string) RangeFacet {
	f.nested = nested
	return f
}

func (f RangeFacet) Mode(mode string) RangeFacet {
	f.mode = mode
	return f
}

func (f RangeFacet) Field(field string) RangeFacet {
	f.keyField = field
	f.valueField = field
	return f
}

func (f RangeFacet) KeyField(keyField string) RangeFacet {
	f.keyField = keyField
	return f
}

func (f RangeFacet) ValueField(valueField string) RangeFacet {
	f.valueField = valueField
	return f
}

func (f RangeFacet) AddRange(from, to interface{}) RangeFacet {
	f.entries = append(f.entries, rangeFacetEntry{From: from, To: to})
	return f
}

func (f RangeFacet) AddUnboundedTo(from interface{}) RangeFacet {
	f.entries = append(f.entries, rangeFacetEntry{From: from, To: nil})
	return f
}

func (f RangeFacet) AddUnboundedFrom(to interface{}) RangeFacet {
	f.entries = append(f.entries, rangeFacetEntry{From: nil, To: to})
	return f
}

func (f RangeFacet) Lt(to interface{}) RangeFacet {
	f.entries = append(f.entries, rangeFacetEntry{From: nil, To: to})
	return f
}

func (f RangeFacet) Between(from, to interface{}) RangeFacet {
	f.entries = append(f.entries, rangeFacetEntry{From: from, To: to})
	return f
}

func (f RangeFacet) Gt(from interface{}) RangeFacet {
	f.entries = append(f.entries, rangeFacetEntry{From: from, To: nil})
	return f
}

func (f RangeFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f RangeFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["range"] = opts

	if f.valueField != "" && f.keyField != f.valueField {
		opts["key_field"] = f.keyField
		opts["value_field"] = f.valueField
	} else {
		opts["field"] = f.keyField
	}

	ranges := make([]interface{}, 0)
	for _, ent := range f.entries {
		r := make(map[string]interface{})
		if ent.From != nil {
			switch from := ent.From.(type) {
			case int, int16, int32, int64, float32, float64:
				r["from"] = from
			case time.Time:
				r["from"] = from.Format(time.RFC3339)
			case string:
				r["from"] = from
			}
		}
		if ent.To != nil {
			switch to := ent.To.(type) {
			case int, int16, int32, int64, float32, float64:
				r["to"] = to
			case time.Time:
				r["to"] = to.Format(time.RFC3339)
			case string:
				r["to"] = to
			}
		}
		ranges = append(ranges, r)
	}
	opts["ranges"] = ranges

	return source
}

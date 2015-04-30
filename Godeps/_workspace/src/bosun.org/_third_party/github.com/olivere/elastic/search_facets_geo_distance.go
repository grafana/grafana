// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The geo_distance facet is a facet providing information for ranges of
// distances from a provided geo_point including count of the number of hits
// that fall within each range, and aggregation information (like total).
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-facets-geo-distance-facet.html
type GeoDistanceFacet struct {
	facetFilter    Filter
	global         *bool
	nested         string
	mode           string
	fieldName      string
	valueFieldName string
	lat            float64
	lon            float64
	geoHash        string
	geoDistance    string
	unit           string
	params         map[string]interface{}
	valueScript    string
	lang           string
	entries        []geoDistanceFacetEntry
}

func NewGeoDistanceFacet() GeoDistanceFacet {
	return GeoDistanceFacet{
		params:  make(map[string]interface{}),
		entries: make([]geoDistanceFacetEntry, 0),
	}
}

func (f GeoDistanceFacet) FacetFilter(filter Facet) GeoDistanceFacet {
	f.facetFilter = filter
	return f
}

func (f GeoDistanceFacet) Global(global bool) GeoDistanceFacet {
	f.global = &global
	return f
}

func (f GeoDistanceFacet) Nested(nested string) GeoDistanceFacet {
	f.nested = nested
	return f
}

func (f GeoDistanceFacet) Mode(mode string) GeoDistanceFacet {
	f.mode = mode
	return f
}

func (f GeoDistanceFacet) Field(fieldName string) GeoDistanceFacet {
	f.fieldName = fieldName
	return f
}

func (f GeoDistanceFacet) ValueField(valueFieldName string) GeoDistanceFacet {
	f.valueFieldName = valueFieldName
	return f
}

func (f GeoDistanceFacet) ValueScript(valueScript string) GeoDistanceFacet {
	f.valueScript = valueScript
	return f
}

func (f GeoDistanceFacet) Lang(lang string) GeoDistanceFacet {
	f.lang = lang
	return f
}

func (f GeoDistanceFacet) ScriptParam(name string, value interface{}) GeoDistanceFacet {
	f.params[name] = value
	return f
}

func (f GeoDistanceFacet) Point(lat, lon float64) GeoDistanceFacet {
	f.lat = lat
	f.lon = lon
	return f
}

func (f GeoDistanceFacet) Lat(lat float64) GeoDistanceFacet {
	f.lat = lat
	return f
}

func (f GeoDistanceFacet) Lon(lon float64) GeoDistanceFacet {
	f.lon = lon
	return f
}

func (f GeoDistanceFacet) GeoHash(geoHash string) GeoDistanceFacet {
	f.geoHash = geoHash
	return f
}

func (f GeoDistanceFacet) GeoDistance(geoDistance string) GeoDistanceFacet {
	f.geoDistance = geoDistance
	return f
}

func (f GeoDistanceFacet) AddRange(from, to float64) GeoDistanceFacet {
	f.entries = append(f.entries, geoDistanceFacetEntry{From: from, To: to})
	return f
}

func (f GeoDistanceFacet) AddUnboundedTo(from float64) GeoDistanceFacet {
	f.entries = append(f.entries, geoDistanceFacetEntry{From: from, To: nil})
	return f
}

func (f GeoDistanceFacet) AddUnboundedFrom(to float64) GeoDistanceFacet {
	f.entries = append(f.entries, geoDistanceFacetEntry{From: nil, To: to})
	return f
}

func (f GeoDistanceFacet) Unit(distanceUnit string) GeoDistanceFacet {
	f.unit = distanceUnit
	return f
}

func (f GeoDistanceFacet) addFilterFacetAndGlobal(source map[string]interface{}) {
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

func (f GeoDistanceFacet) Source() interface{} {
	source := make(map[string]interface{})
	f.addFilterFacetAndGlobal(source)
	opts := make(map[string]interface{})
	source["geo_distance"] = opts

	if f.geoHash != "" {
		opts[f.fieldName] = f.geoHash
	} else {
		opts[f.fieldName] = []float64{f.lat, f.lon}
	}
	if f.valueFieldName != "" {
		opts["value_field"] = f.valueFieldName
	}
	if f.valueScript != "" {
		opts["value_script"] = f.valueScript
		if f.lang != "" {
			opts["lang"] = f.lang
		}
		if len(f.params) > 0 {
			opts["params"] = f.params
		}
	}

	ranges := make([]interface{}, 0)
	for _, ent := range f.entries {
		r := make(map[string]interface{})
		if ent.From != nil {
			switch from := ent.From.(type) {
			case int, int16, int32, int64, float32, float64:
				r["from"] = from
			case string:
				r["from"] = from
			}
		}
		if ent.To != nil {
			switch to := ent.To.(type) {
			case int, int16, int32, int64, float32, float64:
				r["to"] = to
			case string:
				r["to"] = to
			}
		}
		ranges = append(ranges, r)
	}
	opts["ranges"] = ranges

	if f.unit != "" {
		opts["unit"] = f.unit
	}
	if f.geoDistance != "" {
		opts["distance_type"] = f.geoDistance
	}

	return source
}

type geoDistanceFacetEntry struct {
	From interface{}
	To   interface{}
}

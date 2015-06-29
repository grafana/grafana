// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// -- Sorter --

// Sorter is an interface for sorting strategies, e.g. ScoreSort or FieldSort.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html.
type Sorter interface {
	Source() interface{}
}

// -- SortInfo --

// SortInfo contains information about sorting a field.
type SortInfo struct {
	Sorter
	Field          string
	Ascending      bool
	Missing        interface{}
	IgnoreUnmapped *bool
	SortMode       string
	NestedFilter   Filter
	NestedPath     string
}

func (info SortInfo) Source() interface{} {
	prop := make(map[string]interface{})
	if info.Ascending {
		prop["order"] = "asc"
	} else {
		prop["order"] = "desc"
	}
	if info.Missing != nil {
		prop["missing"] = info.Missing
	}
	if info.IgnoreUnmapped != nil {
		prop["ignore_unmapped"] = *info.IgnoreUnmapped
	}
	if info.SortMode != "" {
		prop["sort_mode"] = info.SortMode
	}
	if info.NestedFilter != nil {
		prop["nested_filter"] = info.NestedFilter
	}
	if info.NestedPath != "" {
		prop["nested_path"] = info.NestedPath
	}
	source := make(map[string]interface{})
	source[info.Field] = prop
	return source
}

// -- ScoreSort --

// ScoreSort sorts by relevancy score.
type ScoreSort struct {
	Sorter
	ascending bool
}

// NewScoreSort creates a new ScoreSort.
func NewScoreSort() ScoreSort {
	return ScoreSort{ascending: false} // Descending by default!
}

// Order defines whether sorting ascending (default) or descending.
func (s ScoreSort) Order(ascending bool) ScoreSort {
	s.ascending = ascending
	return s
}

// Asc sets ascending sort order.
func (s ScoreSort) Asc() ScoreSort {
	s.ascending = true
	return s
}

// Desc sets descending sort order.
func (s ScoreSort) Desc() ScoreSort {
	s.ascending = false
	return s
}

// Source returns the JSON-serializable data.
func (s ScoreSort) Source() interface{} {
	source := make(map[string]interface{})
	x := make(map[string]interface{})
	source["_score"] = x
	if s.ascending {
		x["reverse"] = true
	}
	return source
}

// -- FieldSort --

// FieldSort sorts by a given field.
type FieldSort struct {
	Sorter
	fieldName      string
	ascending      bool
	missing        interface{}
	ignoreUnmapped *bool
	unmappedType   *string
	sortMode       *string
	nestedFilter   Filter
	nestedPath     *string
}

// NewFieldSort creates a new FieldSort.
func NewFieldSort(fieldName string) FieldSort {
	return FieldSort{
		fieldName: fieldName,
		ascending: true,
	}
}

// FieldName specifies the name of the field to be used for sorting.
func (s FieldSort) FieldName(fieldName string) FieldSort {
	s.fieldName = fieldName
	return s
}

// Order defines whether sorting ascending (default) or descending.
func (s FieldSort) Order(ascending bool) FieldSort {
	s.ascending = ascending
	return s
}

// Asc sets ascending sort order.
func (s FieldSort) Asc() FieldSort {
	s.ascending = true
	return s
}

// Desc sets descending sort order.
func (s FieldSort) Desc() FieldSort {
	s.ascending = false
	return s
}

// Missing sets the value to be used when a field is missing in a document.
// You can also use "_last" or "_first" to sort missing last or first
// respectively.
func (s FieldSort) Missing(missing interface{}) FieldSort {
	s.missing = missing
	return s
}

// IgnoreUnmapped specifies what happens if the field does not exist in
// the index. Set it to true to ignore, or set it to false to not ignore (default).
func (s FieldSort) IgnoreUnmapped(ignoreUnmapped bool) FieldSort {
	s.ignoreUnmapped = &ignoreUnmapped
	return s
}

// UnmappedType sets the type to use when the current field is not mapped
// in an index.
func (s FieldSort) UnmappedType(typ string) FieldSort {
	s.unmappedType = &typ
	return s
}

// SortMode specifies what values to pick in case a document contains
// multiple values for the targeted sort field. Possible values are:
// min, max, sum, and avg.
func (s FieldSort) SortMode(sortMode string) FieldSort {
	s.sortMode = &sortMode
	return s
}

// NestedFilter sets a filter that nested objects should match with
// in order to be taken into account for sorting.
func (s FieldSort) NestedFilter(nestedFilter Filter) FieldSort {
	s.nestedFilter = nestedFilter
	return s
}

// NestedPath is used if sorting occurs on a field that is inside a
// nested object.
func (s FieldSort) NestedPath(nestedPath string) FieldSort {
	s.nestedPath = &nestedPath
	return s
}

// Source returns the JSON-serializable data.
func (s FieldSort) Source() interface{} {
	source := make(map[string]interface{})
	x := make(map[string]interface{})
	source[s.fieldName] = x
	if s.ascending {
		x["order"] = "asc"
	} else {
		x["order"] = "desc"
	}
	if s.missing != nil {
		x["missing"] = s.missing
	}
	if s.ignoreUnmapped != nil {
		x["ignore_unmapped"] = *s.ignoreUnmapped
	}
	if s.unmappedType != nil {
		x["unmapped_type"] = *s.unmappedType
	}
	if s.sortMode != nil {
		x["mode"] = *s.sortMode
	}
	if s.nestedFilter != nil {
		x["nested_filter"] = s.nestedFilter.Source()
	}
	if s.nestedPath != nil {
		x["nested_path"] = *s.nestedPath
	}
	return source
}

// -- GeoDistanceSort --

// GeoDistanceSort allows for sorting by geographic distance.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html#_geo_distance_sorting.
type GeoDistanceSort struct {
	Sorter
	fieldName    string
	points       []*GeoPoint
	geohashes    []string
	geoDistance  *string
	unit         string
	ascending    bool
	sortMode     *string
	nestedFilter Filter
	nestedPath   *string
}

// NewGeoDistanceSort creates a new sorter for geo distances.
func NewGeoDistanceSort(fieldName string) GeoDistanceSort {
	return GeoDistanceSort{
		fieldName: fieldName,
		points:    make([]*GeoPoint, 0),
		geohashes: make([]string, 0),
		ascending: true,
	}
}

// FieldName specifies the name of the (geo) field to use for sorting.
func (s GeoDistanceSort) FieldName(fieldName string) GeoDistanceSort {
	s.fieldName = fieldName
	return s
}

// Order defines whether sorting ascending (default) or descending.
func (s GeoDistanceSort) Order(ascending bool) GeoDistanceSort {
	s.ascending = ascending
	return s
}

// Asc sets ascending sort order.
func (s GeoDistanceSort) Asc() GeoDistanceSort {
	s.ascending = true
	return s
}

// Desc sets descending sort order.
func (s GeoDistanceSort) Desc() GeoDistanceSort {
	s.ascending = false
	return s
}

// Point specifies a point to create the range distance facets from.
func (s GeoDistanceSort) Point(lat, lon float64) GeoDistanceSort {
	s.points = append(s.points, GeoPointFromLatLon(lat, lon))
	return s
}

// Points specifies the geo point(s) to create the range distance facets from.
func (s GeoDistanceSort) Points(points ...*GeoPoint) GeoDistanceSort {
	s.points = append(s.points, points...)
	return s
}

// GeoHashes specifies the geo point to create the range distance facets from.
func (s GeoDistanceSort) GeoHashes(geohashes ...string) GeoDistanceSort {
	s.geohashes = append(s.geohashes, geohashes...)
	return s
}

// GeoDistance represents how to compute the distance.
// It can be sloppy_arc (default), arc, or plane.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html#_geo_distance_sorting.
func (s GeoDistanceSort) GeoDistance(geoDistance string) GeoDistanceSort {
	s.geoDistance = &geoDistance
	return s
}

// Unit specifies the distance unit to use. It defaults to km.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/common-options.html#distance-units
// for details.
func (s GeoDistanceSort) Unit(unit string) GeoDistanceSort {
	s.unit = unit
	return s
}

// SortMode specifies what values to pick in case a document contains
// multiple values for the targeted sort field. Possible values are:
// min, max, sum, and avg.
func (s GeoDistanceSort) SortMode(sortMode string) GeoDistanceSort {
	s.sortMode = &sortMode
	return s
}

// NestedFilter sets a filter that nested objects should match with
// in order to be taken into account for sorting.
func (s GeoDistanceSort) NestedFilter(nestedFilter Filter) GeoDistanceSort {
	s.nestedFilter = nestedFilter
	return s
}

// NestedPath is used if sorting occurs on a field that is inside a
// nested object.
func (s GeoDistanceSort) NestedPath(nestedPath string) GeoDistanceSort {
	s.nestedPath = &nestedPath
	return s
}

// Source returns the JSON-serializable data.
func (s GeoDistanceSort) Source() interface{} {
	source := make(map[string]interface{})
	x := make(map[string]interface{})
	source["_geo_distance"] = x

	// Points
	ptarr := make([]interface{}, 0)
	for _, pt := range s.points {
		ptarr = append(ptarr, pt.Source())
	}
	for _, geohash := range s.geohashes {
		ptarr = append(ptarr, geohash)
	}
	x[s.fieldName] = ptarr

	if s.unit != "" {
		x["unit"] = s.unit
	}
	if s.geoDistance != nil {
		x["distance_type"] = *s.geoDistance
	}

	if !s.ascending {
		x["reverse"] = true
	}
	if s.sortMode != nil {
		x["mode"] = *s.sortMode
	}
	if s.nestedFilter != nil {
		x["nested_filter"] = s.nestedFilter.Source()
	}
	if s.nestedPath != nil {
		x["nested_path"] = *s.nestedPath
	}
	return source
}

// -- ScriptSort --

// ScriptSort sorts by a custom script. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/modules-scripting.html#modules-scripting
// for details about scripting.
type ScriptSort struct {
	Sorter
	lang         string
	script       string
	typ          string
	params       map[string]interface{}
	ascending    bool
	sortMode     *string
	nestedFilter Filter
	nestedPath   *string
}

// NewScriptSort creates a new ScriptSort.
func NewScriptSort(script, typ string) ScriptSort {
	return ScriptSort{
		script:    script,
		typ:       typ,
		ascending: true,
		params:    make(map[string]interface{}),
	}
}

// Lang specifies the script language to use. It can be one of:
// groovy (the default for ES >= 1.4), mvel (default for ES < 1.4),
// js, python, expression, or native. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/modules-scripting.html#modules-scripting
// for details.
func (s ScriptSort) Lang(lang string) ScriptSort {
	s.lang = lang
	return s
}

// Type sets the script type, which can be either string or number.
func (s ScriptSort) Type(typ string) ScriptSort {
	s.typ = typ
	return s
}

// Param adds a parameter to the script.
func (s ScriptSort) Param(name string, value interface{}) ScriptSort {
	s.params[name] = value
	return s
}

// Params sets the parameters of the script.
func (s ScriptSort) Params(params map[string]interface{}) ScriptSort {
	s.params = params
	return s
}

// Order defines whether sorting ascending (default) or descending.
func (s ScriptSort) Order(ascending bool) ScriptSort {
	s.ascending = ascending
	return s
}

// Asc sets ascending sort order.
func (s ScriptSort) Asc() ScriptSort {
	s.ascending = true
	return s
}

// Desc sets descending sort order.
func (s ScriptSort) Desc() ScriptSort {
	s.ascending = false
	return s
}

// SortMode specifies what values to pick in case a document contains
// multiple values for the targeted sort field. Possible values are:
// min or max.
func (s ScriptSort) SortMode(sortMode string) ScriptSort {
	s.sortMode = &sortMode
	return s
}

// NestedFilter sets a filter that nested objects should match with
// in order to be taken into account for sorting.
func (s ScriptSort) NestedFilter(nestedFilter Filter) ScriptSort {
	s.nestedFilter = nestedFilter
	return s
}

// NestedPath is used if sorting occurs on a field that is inside a
// nested object.
func (s ScriptSort) NestedPath(nestedPath string) ScriptSort {
	s.nestedPath = &nestedPath
	return s
}

// Source returns the JSON-serializable data.
func (s ScriptSort) Source() interface{} {
	source := make(map[string]interface{})
	x := make(map[string]interface{})
	source["_script"] = x

	x["script"] = s.script
	x["type"] = s.typ
	if !s.ascending {
		x["reverse"] = true
	}
	if s.lang != "" {
		x["lang"] = s.lang
	}
	if len(s.params) > 0 {
		x["params"] = s.params
	}
	if s.sortMode != nil {
		x["mode"] = *s.sortMode
	}
	if s.nestedFilter != nil {
		x["nested_filter"] = s.nestedFilter.Source()
	}
	if s.nestedPath != nil {
		x["nested_path"] = *s.nestedPath
	}
	return source
}

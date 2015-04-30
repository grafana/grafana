// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// A filter allowing to include hits that only fall within a polygon of points.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-geo-polygon-filter.html
type GeoPolygonFilter struct {
	Filter
	name       string
	points     []*GeoPoint
	cache      *bool
	cacheKey   string
	filterName string
}

func NewGeoPolygonFilter(name string) GeoPolygonFilter {
	f := GeoPolygonFilter{name: name, points: make([]*GeoPoint, 0)}
	return f
}

func (f GeoPolygonFilter) Cache(cache bool) GeoPolygonFilter {
	f.cache = &cache
	return f
}

func (f GeoPolygonFilter) CacheKey(cacheKey string) GeoPolygonFilter {
	f.cacheKey = cacheKey
	return f
}

func (f GeoPolygonFilter) FilterName(filterName string) GeoPolygonFilter {
	f.filterName = filterName
	return f
}

func (f GeoPolygonFilter) AddPoint(point *GeoPoint) GeoPolygonFilter {
	f.points = append(f.points, point)
	return f
}

func (f GeoPolygonFilter) Source() interface{} {
	// "geo_polygon" : {
	//  	"person.location" : {
	//         "points" : [
	//             {"lat" : 40, "lon" : -70},
	//             {"lat" : 30, "lon" : -80},
	//             {"lat" : 20, "lon" : -90}
	//         ]
	//     }
	// }
	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["geo_polygon"] = params

	polygon := make(map[string]interface{})
	params[f.name] = polygon

	points := make([]interface{}, 0)
	for _, point := range f.points {
		points = append(points, point.Source())
	}
	polygon["points"] = points

	if f.filterName != "" {
		params["_name"] = f.filterName
	}

	if f.cache != nil {
		params["_cache"] = *f.cache
	}

	if f.cacheKey != "" {
		params["_cache_key"] = f.cacheKey
	}

	return source
}

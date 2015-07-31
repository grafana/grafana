// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// GeoDistanceFilter filters documents that include only hits that exists
// within a specific distance from a geo point.
//
// For more details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-geo-distance-filter.html
type GeoDistanceFilter struct {
	Filter
	name         string
	distance     string
	lat          float64
	lon          float64
	geohash      string
	distanceType string
	optimizeBbox string
	cache        *bool
	cacheKey     string
	filterName   string
}

// NewGeoDistanceFilter creates a new GeoDistanceFilter.
func NewGeoDistanceFilter(name string) GeoDistanceFilter {
	f := GeoDistanceFilter{name: name}
	return f
}

func (f GeoDistanceFilter) Distance(distance string) GeoDistanceFilter {
	f.distance = distance
	return f
}

func (f GeoDistanceFilter) GeoPoint(point *GeoPoint) GeoDistanceFilter {
	f.lat = point.Lat
	f.lon = point.Lon
	return f
}

func (f GeoDistanceFilter) Point(lat, lon float64) GeoDistanceFilter {
	f.lat = lat
	f.lon = lon
	return f
}

func (f GeoDistanceFilter) Lat(lat float64) GeoDistanceFilter {
	f.lat = lat
	return f
}

func (f GeoDistanceFilter) Lon(lon float64) GeoDistanceFilter {
	f.lon = lon
	return f
}

func (f GeoDistanceFilter) GeoHash(geohash string) GeoDistanceFilter {
	f.geohash = geohash
	return f
}

func (f GeoDistanceFilter) DistanceType(distanceType string) GeoDistanceFilter {
	f.distanceType = distanceType
	return f
}

func (f GeoDistanceFilter) OptimizeBbox(optimizeBbox string) GeoDistanceFilter {
	f.optimizeBbox = optimizeBbox
	return f
}

func (f GeoDistanceFilter) Cache(cache bool) GeoDistanceFilter {
	f.cache = &cache
	return f
}

func (f GeoDistanceFilter) CacheKey(cacheKey string) GeoDistanceFilter {
	f.cacheKey = cacheKey
	return f
}

func (f GeoDistanceFilter) FilterName(filterName string) GeoDistanceFilter {
	f.filterName = filterName
	return f
}

// Creates the query source for the geo_distance filter.
func (f GeoDistanceFilter) Source() interface{} {
	// {
	//   "geo_distance" : {
	//       "distance" : "200km",
	//       "pin.location" : {
	//           "lat" : 40,
	//           "lon" : -70
	//       }
	//   }
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})

	if f.geohash != "" {
		params[f.name] = f.geohash
	} else {
		location := make(map[string]interface{})
		location["lat"] = f.lat
		location["lon"] = f.lon
		params[f.name] = location
	}

	if f.distance != "" {
		params["distance"] = f.distance
	}
	if f.distanceType != "" {
		params["distance_type"] = f.distanceType
	}
	if f.optimizeBbox != "" {
		params["optimize_bbox"] = f.optimizeBbox
	}
	if f.cache != nil {
		params["_cache"] = *f.cache
	}
	if f.cacheKey != "" {
		params["_cache_key"] = f.cacheKey
	}
	if f.filterName != "" {
		params["_name"] = f.filterName
	}

	source["geo_distance"] = params

	return source
}

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// GeoBoundsAggregation is a metric aggregation that computes the
// bounding box containing all geo_point values for a field.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-geobounds-aggregation.html
type GeoBoundsAggregation struct {
	field         string
	script        string
	scriptFile    string
	lang          string
	params        map[string]interface{}
	wrapLongitude *bool
}

func NewGeoBoundsAggregation() GeoBoundsAggregation {
	a := GeoBoundsAggregation{}
	return a
}

func (a GeoBoundsAggregation) Field(field string) GeoBoundsAggregation {
	a.field = field
	return a
}

func (a GeoBoundsAggregation) Script(script string) GeoBoundsAggregation {
	a.script = script
	return a
}

func (a GeoBoundsAggregation) ScriptFile(scriptFile string) GeoBoundsAggregation {
	a.scriptFile = scriptFile
	return a
}

func (a GeoBoundsAggregation) Lang(lang string) GeoBoundsAggregation {
	a.lang = lang
	return a
}

func (a GeoBoundsAggregation) Params(params map[string]interface{}) GeoBoundsAggregation {
	a.params = params
	return a
}

func (a GeoBoundsAggregation) Param(name string, value interface{}) GeoBoundsAggregation {
	if a.params == nil {
		a.params = make(map[string]interface{})
	}
	a.params[name] = value
	return a
}

func (a GeoBoundsAggregation) WrapLongitude(wrapLongitude bool) GeoBoundsAggregation {
	a.wrapLongitude = &wrapLongitude
	return a
}

func (a GeoBoundsAggregation) Source() interface{} {
	// Example:
	// {
	//     "query" : {
	//         "match" : { "business_type" : "shop" }
	//     },
	//     "aggs" : {
	//         "viewport" : {
	//             "geo_bounds" : {
	//                 "field" : "location"
	//                 "wrap_longitude" : "true"
	//             }
	//         }
	//     }
	// }
	//
	// This method returns only the { "geo_bounds" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["geo_bounds"] = opts

	if a.field != "" {
		opts["field"] = a.field
	}
	if a.script != "" {
		opts["script"] = a.script
	}
	if a.scriptFile != "" {
		opts["script_file"] = a.scriptFile
	}
	if a.lang != "" {
		opts["lang"] = a.lang
	}
	if a.params != nil && len(a.params) > 0 {
		opts["params"] = a.params
	}
	if a.wrapLongitude != nil {
		opts["wrap_longitude"] = *a.wrapLongitude
	}

	return source
}

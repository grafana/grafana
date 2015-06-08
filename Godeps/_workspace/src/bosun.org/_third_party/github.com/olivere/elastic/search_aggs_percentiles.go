// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// PercentilesAggregation
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-percentile-aggregation.html
type PercentilesAggregation struct {
	field           string
	script          string
	scriptFile      string
	lang            string
	format          string
	params          map[string]interface{}
	subAggregations map[string]Aggregation
	percentiles     []float64
	compression     *float64
	estimator       string
}

func NewPercentilesAggregation() PercentilesAggregation {
	a := PercentilesAggregation{
		params:          make(map[string]interface{}),
		subAggregations: make(map[string]Aggregation),
		percentiles:     make([]float64, 0),
	}
	return a
}

func (a PercentilesAggregation) Field(field string) PercentilesAggregation {
	a.field = field
	return a
}

func (a PercentilesAggregation) Script(script string) PercentilesAggregation {
	a.script = script
	return a
}

func (a PercentilesAggregation) ScriptFile(scriptFile string) PercentilesAggregation {
	a.scriptFile = scriptFile
	return a
}

func (a PercentilesAggregation) Lang(lang string) PercentilesAggregation {
	a.lang = lang
	return a
}

func (a PercentilesAggregation) Format(format string) PercentilesAggregation {
	a.format = format
	return a
}

func (a PercentilesAggregation) Param(name string, value interface{}) PercentilesAggregation {
	a.params[name] = value
	return a
}

func (a PercentilesAggregation) SubAggregation(name string, subAggregation Aggregation) PercentilesAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a PercentilesAggregation) Percentiles(percentiles ...float64) PercentilesAggregation {
	a.percentiles = make([]float64, 0)
	a.percentiles = append(a.percentiles, percentiles...)
	return a
}

func (a PercentilesAggregation) Compression(compression float64) PercentilesAggregation {
	a.compression = &compression
	return a
}

func (a PercentilesAggregation) Estimator(estimator string) PercentilesAggregation {
	a.estimator = estimator
	return a
}

func (a PercentilesAggregation) Source() interface{} {
	// Example:
	//	{
	//    "aggs" : {
	//      "load_time_outlier" : {
	//           "percentiles" : {
	//               "field" : "load_time"
	//           }
	//       }
	//    }
	//	}
	// This method returns only the
	//   { "percentiles" : { "field" : "load_time" } }
	// part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["percentiles"] = opts

	// ValuesSourceAggregationBuilder
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
	if a.format != "" {
		opts["format"] = a.format
	}
	if len(a.params) > 0 {
		opts["params"] = a.params
	}
	if len(a.percentiles) > 0 {
		opts["percents"] = a.percentiles
	}
	if a.compression != nil {
		opts["compression"] = *a.compression
	}
	if a.estimator != "" {
		opts["estimator"] = a.estimator
	}

	// AggregationBuilder (SubAggregations)
	if len(a.subAggregations) > 0 {
		aggsMap := make(map[string]interface{})
		source["aggregations"] = aggsMap
		for name, aggregate := range a.subAggregations {
			aggsMap[name] = aggregate.Source()
		}
	}

	return source
}

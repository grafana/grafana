// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// PercentileRanksAggregation
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-percentile-rank-aggregation.html
type PercentileRanksAggregation struct {
	field           string
	script          string
	scriptFile      string
	lang            string
	format          string
	params          map[string]interface{}
	subAggregations map[string]Aggregation
	values          []float64
	compression     *float64
	estimator       string
}

func NewPercentileRanksAggregation() PercentileRanksAggregation {
	a := PercentileRanksAggregation{
		params:          make(map[string]interface{}),
		subAggregations: make(map[string]Aggregation),
		values:          make([]float64, 0),
	}
	return a
}

func (a PercentileRanksAggregation) Field(field string) PercentileRanksAggregation {
	a.field = field
	return a
}

func (a PercentileRanksAggregation) Script(script string) PercentileRanksAggregation {
	a.script = script
	return a
}

func (a PercentileRanksAggregation) ScriptFile(scriptFile string) PercentileRanksAggregation {
	a.scriptFile = scriptFile
	return a
}

func (a PercentileRanksAggregation) Lang(lang string) PercentileRanksAggregation {
	a.lang = lang
	return a
}

func (a PercentileRanksAggregation) Format(format string) PercentileRanksAggregation {
	a.format = format
	return a
}

func (a PercentileRanksAggregation) Param(name string, value interface{}) PercentileRanksAggregation {
	a.params[name] = value
	return a
}

func (a PercentileRanksAggregation) SubAggregation(name string, subAggregation Aggregation) PercentileRanksAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a PercentileRanksAggregation) Values(values ...float64) PercentileRanksAggregation {
	a.values = make([]float64, 0)
	a.values = append(a.values, values...)
	return a
}

func (a PercentileRanksAggregation) Compression(compression float64) PercentileRanksAggregation {
	a.compression = &compression
	return a
}

func (a PercentileRanksAggregation) Estimator(estimator string) PercentileRanksAggregation {
	a.estimator = estimator
	return a
}

func (a PercentileRanksAggregation) Source() interface{} {
	// Example:
	//	{
	//    "aggs" : {
	//      "load_time_outlier" : {
	//         "percentile_ranks" : {
	//           "field" : "load_time"
	//           "values" : [15, 30]
	//         }
	//       }
	//    }
	//	}
	// This method returns only the
	//   { "percentile_ranks" : { "field" : "load_time", "values" : [15, 30] } }
	// part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["percentile_ranks"] = opts

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
	if len(a.values) > 0 {
		opts["values"] = a.values
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

// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"time"
)

// DateRangeAggregation is a range aggregation that is dedicated for
// date values. The main difference between this aggregation and the
// normal range aggregation is that the from and to values can be expressed
// in Date Math expressions, and it is also possible to specify a
// date format by which the from and to response fields will be returned.
// Note that this aggregration includes the from value and excludes the to
// value for each range.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-daterange-aggregation.html
type DateRangeAggregation struct {
	field           string
	script          string
	scriptFile      string
	lang            string
	params          map[string]interface{}
	subAggregations map[string]Aggregation
	keyed           *bool
	unmapped        *bool
	format          string
	entries         []DateRangeAggregationEntry
}

type DateRangeAggregationEntry struct {
	Key  string
	From interface{}
	To   interface{}
}

func NewDateRangeAggregation() DateRangeAggregation {
	a := DateRangeAggregation{
		params:          make(map[string]interface{}),
		subAggregations: make(map[string]Aggregation),
		entries:         make([]DateRangeAggregationEntry, 0),
	}
	return a
}

func (a DateRangeAggregation) Field(field string) DateRangeAggregation {
	a.field = field
	return a
}

func (a DateRangeAggregation) Script(script string) DateRangeAggregation {
	a.script = script
	return a
}

func (a DateRangeAggregation) ScriptFile(scriptFile string) DateRangeAggregation {
	a.scriptFile = scriptFile
	return a
}

func (a DateRangeAggregation) Lang(lang string) DateRangeAggregation {
	a.lang = lang
	return a
}

func (a DateRangeAggregation) Param(name string, value interface{}) DateRangeAggregation {
	a.params[name] = value
	return a
}

func (a DateRangeAggregation) SubAggregation(name string, subAggregation Aggregation) DateRangeAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a DateRangeAggregation) Keyed(keyed bool) DateRangeAggregation {
	a.keyed = &keyed
	return a
}

func (a DateRangeAggregation) Unmapped(unmapped bool) DateRangeAggregation {
	a.unmapped = &unmapped
	return a
}

func (a DateRangeAggregation) Format(format string) DateRangeAggregation {
	a.format = format
	return a
}

func (a DateRangeAggregation) AddRange(from, to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: to})
	return a
}

func (a DateRangeAggregation) AddRangeWithKey(key string, from, to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a DateRangeAggregation) AddUnboundedTo(from interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: nil})
	return a
}

func (a DateRangeAggregation) AddUnboundedToWithKey(key string, from interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a DateRangeAggregation) AddUnboundedFrom(to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: nil, To: to})
	return a
}

func (a DateRangeAggregation) AddUnboundedFromWithKey(key string, to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a DateRangeAggregation) Lt(to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: nil, To: to})
	return a
}

func (a DateRangeAggregation) LtWithKey(key string, to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a DateRangeAggregation) Between(from, to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: to})
	return a
}

func (a DateRangeAggregation) BetweenWithKey(key string, from, to interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a DateRangeAggregation) Gt(from interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: nil})
	return a
}

func (a DateRangeAggregation) GtWithKey(key string, from interface{}) DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a DateRangeAggregation) Source() interface{} {
	// Example:
	// {
	//     "aggs" : {
	//         "range" : {
	//             "date_range": {
	//                 "field": "date",
	//                 "format": "MM-yyy",
	//                 "ranges": [
	//                     { "to": "now-10M/M" },
	//                     { "from": "now-10M/M" }
	//                 ]
	//             }
	//         }
	//         }
	//     }
	// }
	//
	// This method returns only the { "date_range" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["date_range"] = opts

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
	if len(a.params) > 0 {
		opts["params"] = a.params
	}

	if a.keyed != nil {
		opts["keyed"] = *a.keyed
	}
	if a.unmapped != nil {
		opts["unmapped"] = *a.unmapped
	}
	if a.format != "" {
		opts["format"] = a.format
	}

	ranges := make([]interface{}, 0)
	for _, ent := range a.entries {
		r := make(map[string]interface{})
		if ent.Key != "" {
			r["key"] = ent.Key
		}
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

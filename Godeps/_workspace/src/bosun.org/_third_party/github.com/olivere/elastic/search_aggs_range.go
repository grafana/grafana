// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"time"
)

// RangeAggregation is a multi-bucket value source based aggregation that
// enables the user to define a set of ranges - each representing a bucket.
// During the aggregation process, the values extracted from each document
// will be checked against each bucket range and "bucket" the
// relevant/matching document. Note that this aggregration includes the
// from value and excludes the to value for each range.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-range-aggregation.html
type RangeAggregation struct {
	field           string
	script          string
	scriptFile      string
	lang            string
	params          map[string]interface{}
	subAggregations map[string]Aggregation
	keyed           *bool
	unmapped        *bool
	entries         []rangeAggregationEntry
}

type rangeAggregationEntry struct {
	Key  string
	From interface{}
	To   interface{}
}

func NewRangeAggregation() RangeAggregation {
	a := RangeAggregation{
		params:          make(map[string]interface{}),
		subAggregations: make(map[string]Aggregation),
		entries:         make([]rangeAggregationEntry, 0),
	}
	return a
}

func (a RangeAggregation) Field(field string) RangeAggregation {
	a.field = field
	return a
}

func (a RangeAggregation) Script(script string) RangeAggregation {
	a.script = script
	return a
}

func (a RangeAggregation) ScriptFile(scriptFile string) RangeAggregation {
	a.scriptFile = scriptFile
	return a
}

func (a RangeAggregation) Lang(lang string) RangeAggregation {
	a.lang = lang
	return a
}

func (a RangeAggregation) Param(name string, value interface{}) RangeAggregation {
	a.params[name] = value
	return a
}

func (a RangeAggregation) SubAggregation(name string, subAggregation Aggregation) RangeAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a RangeAggregation) Keyed(keyed bool) RangeAggregation {
	a.keyed = &keyed
	return a
}

func (a RangeAggregation) Unmapped(unmapped bool) RangeAggregation {
	a.unmapped = &unmapped
	return a
}

func (a RangeAggregation) AddRange(from, to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: to})
	return a
}

func (a RangeAggregation) AddRangeWithKey(key string, from, to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a RangeAggregation) AddUnboundedTo(from interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: nil})
	return a
}

func (a RangeAggregation) AddUnboundedToWithKey(key string, from interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a RangeAggregation) AddUnboundedFrom(to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: nil, To: to})
	return a
}

func (a RangeAggregation) AddUnboundedFromWithKey(key string, to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a RangeAggregation) Lt(to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: nil, To: to})
	return a
}

func (a RangeAggregation) LtWithKey(key string, to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a RangeAggregation) Between(from, to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: to})
	return a
}

func (a RangeAggregation) BetweenWithKey(key string, from, to interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a RangeAggregation) Gt(from interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: nil})
	return a
}

func (a RangeAggregation) GtWithKey(key string, from interface{}) RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a RangeAggregation) Source() interface{} {
	// Example:
	// {
	//     "aggs" : {
	//         "price_ranges" : {
	//             "range" : {
	//                 "field" : "price",
	//                 "ranges" : [
	//                     { "to" : 50 },
	//                     { "from" : 50, "to" : 100 },
	//                     { "from" : 100 }
	//                 ]
	//             }
	//         }
	//     }
	// }
	//
	// This method returns only the { "range" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["range"] = opts

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

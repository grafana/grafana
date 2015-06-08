// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// Matches documents with fields that have terms within a certain range.
// For details, see:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-range-query.html
type RangeQuery struct {
	Query
	name         string
	from         *interface{}
	to           *interface{}
	timeZone     string
	includeLower bool
	includeUpper bool
	boost        *float64
	queryName    string
}

func NewRangeQuery(name string) RangeQuery {
	q := RangeQuery{name: name, includeLower: true, includeUpper: true}
	return q
}

func (f RangeQuery) TimeZone(timeZone string) RangeQuery {
	f.timeZone = timeZone
	return f
}

func (q RangeQuery) From(from interface{}) RangeQuery {
	q.from = &from
	return q
}

func (q RangeQuery) Gt(from interface{}) RangeQuery {
	q.from = &from
	q.includeLower = false
	return q
}

func (q RangeQuery) Gte(from interface{}) RangeQuery {
	q.from = &from
	q.includeLower = true
	return q
}

func (q RangeQuery) To(to interface{}) RangeQuery {
	q.to = &to
	return q
}

func (q RangeQuery) Lt(to interface{}) RangeQuery {
	q.to = &to
	q.includeUpper = false
	return q
}

func (q RangeQuery) Lte(to interface{}) RangeQuery {
	q.to = &to
	q.includeUpper = true
	return q
}

func (q RangeQuery) IncludeLower(includeLower bool) RangeQuery {
	q.includeLower = includeLower
	return q
}

func (q RangeQuery) IncludeUpper(includeUpper bool) RangeQuery {
	q.includeUpper = includeUpper
	return q
}

func (q RangeQuery) Boost(boost float64) RangeQuery {
	q.boost = &boost
	return q
}

func (q RangeQuery) QueryName(queryName string) RangeQuery {
	q.queryName = queryName
	return q
}

func (q RangeQuery) Source() interface{} {
	// {
	//   "range" : {
	//     "name" : {
	//       "..." : "..."
	//     }
	//   }
	// }

	source := make(map[string]interface{})

	rangeQ := make(map[string]interface{})
	source["range"] = rangeQ

	params := make(map[string]interface{})
	rangeQ[q.name] = params

	params["from"] = q.from
	params["to"] = q.to
	if q.timeZone != "" {
		params["time_zone"] = q.timeZone
	}
	params["include_lower"] = q.includeLower
	params["include_upper"] = q.includeUpper

	if q.boost != nil {
		rangeQ["boost"] = *q.boost
	}

	if q.queryName != "" {
		rangeQ["_name"] = q.queryName
	}

	return source
}

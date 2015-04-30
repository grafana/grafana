// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// FuzzyQuery uses similarity based on Levenshtein edit distance for
// string fields, and a +/- margin on numeric and date fields.
// For more details, see
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/query-dsl-fuzzy-query.html
type FuzzyQuery struct {
	Query

	name           string
	value          interface{}
	boost          float32
	fuzziness      interface{}
	prefixLength   *int
	maxExpansions  *int
	transpositions *bool
	queryName      string
}

// NewFuzzyQuery creates a new fuzzy query.
func NewFuzzyQuery() FuzzyQuery {
	q := FuzzyQuery{
		boost: -1.0,
	}
	return q
}

func (q FuzzyQuery) Name(name string) FuzzyQuery {
	q.name = name
	return q
}

func (q FuzzyQuery) Value(value interface{}) FuzzyQuery {
	q.value = value
	return q
}

func (q FuzzyQuery) Boost(boost float32) FuzzyQuery {
	q.boost = boost
	return q
}

// Fuzziness can be an integer/long like 0, 1 or 2 as well as strings like "auto",
// "0..1", "1..4" or "0.0..1.0".
func (q FuzzyQuery) Fuzziness(fuzziness interface{}) FuzzyQuery {
	q.fuzziness = fuzziness
	return q
}

func (q FuzzyQuery) PrefixLength(prefixLength int) FuzzyQuery {
	q.prefixLength = &prefixLength
	return q
}

func (q FuzzyQuery) MaxExpansions(maxExpansions int) FuzzyQuery {
	q.maxExpansions = &maxExpansions
	return q
}

func (q FuzzyQuery) Transpositions(transpositions bool) FuzzyQuery {
	q.transpositions = &transpositions
	return q
}

func (q FuzzyQuery) QueryName(queryName string) FuzzyQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the ids query.
func (q FuzzyQuery) Source() interface{} {
	// {
	//	"fuzzy" : {
	//		"user" : {
	//      "value" : "ki",
	//      "boost" : 1.0,
	//      "fuzziness" : 2,
	//      "prefix_length" : 0,
	//      "max_expansions" : 100
	//    }
	// }

	source := make(map[string]interface{})

	query := make(map[string]interface{})
	source["fuzzy"] = query

	fq := make(map[string]interface{})
	query[q.name] = fq

	fq["value"] = q.value

	if q.boost != -1.0 {
		fq["boost"] = q.boost
	}
	if q.transpositions != nil {
		fq["transpositions"] = *q.transpositions
	}
	if q.fuzziness != nil {
		fq["fuzziness"] = q.fuzziness
	}
	if q.prefixLength != nil {
		fq["prefix_length"] = *q.prefixLength
	}
	if q.maxExpansions != nil {
		fq["max_expansions"] = *q.maxExpansions
	}
	if q.queryName != "" {
		fq["_name"] = q.queryName
	}

	return source
}

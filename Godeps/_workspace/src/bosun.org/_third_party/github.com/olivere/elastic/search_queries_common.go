// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// The common terms query is a modern alternative to stopwords
// which improves the precision and recall of search results
// (by taking stopwords into account), without sacrificing performance.
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/common-terms-query/
type CommonQuery struct {
	Query
	name             string
	query            string
	cutoffFreq       *float64
	highFreq         *float64
	highFreqOp       string
	highFreqMinMatch interface{}
	lowFreq          *float64
	lowFreqOp        string
	lowFreqMinMatch  interface{}
	analyzer         string
	boost            *float64
	disableCoords    *bool
}

// Creates a new common query.
func NewCommonQuery(name string, query string) CommonQuery {
	q := CommonQuery{name: name, query: query}
	return q
}

func (q *CommonQuery) CutoffFrequency(f float64) *CommonQuery {
	q.cutoffFreq = &f
	return q
}

func (q *CommonQuery) HighFreq(f float64) *CommonQuery {
	q.highFreq = &f
	return q
}

func (q *CommonQuery) HighFreqOperator(op string) *CommonQuery {
	q.highFreqOp = op
	return q
}

func (q *CommonQuery) HighFreqMinMatch(min interface{}) *CommonQuery {
	q.highFreqMinMatch = min
	return q
}

func (q *CommonQuery) LowFreq(f float64) *CommonQuery {
	q.lowFreq = &f
	return q
}

func (q *CommonQuery) LowFreqOperator(op string) *CommonQuery {
	q.lowFreqOp = op
	return q
}

func (q *CommonQuery) LowFreqMinMatch(min interface{}) *CommonQuery {
	q.lowFreqMinMatch = min
	return q
}

func (q *CommonQuery) Analyzer(analyzer string) *CommonQuery {
	q.analyzer = analyzer
	return q
}

func (q *CommonQuery) Boost(boost float64) *CommonQuery {
	q.boost = &boost
	return q
}

func (q *CommonQuery) DisableCoords(disable bool) *CommonQuery {
	q.disableCoords = &disable
	return q
}

// Creates the query source for the common query.
func (q CommonQuery) Source() interface{} {
	//  {
	//    "common": {
	//      "body": {
	//        "query":            "this is bonsai cool",
	//        "cutoff_frequency": 0.001
	//      }
	//    }
	//  }
	source := make(map[string]interface{})
	body := make(map[string]interface{})
	query := make(map[string]interface{})

	source["common"] = body
	body[q.name] = query
	query["query"] = q.query

	if q.cutoffFreq != nil {
		query["cutoff_frequency"] = *(q.cutoffFreq)
	}

	if q.highFreq != nil {
		query["high_freq"] = *(q.highFreq)
	}
	if q.highFreqOp != "" {
		query["high_freq_operator"] = q.highFreqOp
	}

	if q.lowFreq != nil {
		query["low_freq"] = *(q.lowFreq)
	}
	if q.lowFreqOp != "" {
		query["low_freq_operator"] = q.lowFreqOp
	}

	if q.lowFreqMinMatch != nil || q.highFreqMinMatch != nil {
		mm := make(map[string]interface{})
		if q.lowFreqMinMatch != nil {
			mm["low_freq"] = q.lowFreqMinMatch
		}
		if q.highFreqMinMatch != nil {
			mm["high_freq"] = q.highFreqMinMatch
		}
		query["minimum_should_match"] = mm
	}

	if q.analyzer != "" {
		query["analyzer"] = q.analyzer
	}

	if q.disableCoords != nil {
		query["disable_coords"] = *(q.disableCoords)
	}

	if q.boost != nil {
		query["boost"] = *(q.boost)
	}

	return source
}

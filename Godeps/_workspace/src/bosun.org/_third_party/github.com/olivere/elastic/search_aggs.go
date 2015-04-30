// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"encoding/json"
)

// Aggregations can be seen as a unit-of-work that build
// analytic information over a set of documents. It is
// (in many senses) the follow-up of facets in Elasticsearch.
// For more details about aggregations, visit:
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations.html
type Aggregation interface {
	Source() interface{}
}

// Aggregations is a list of aggregations that are part of a search result.
type Aggregations map[string]json.RawMessage

// Min returns min aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-min-aggregation.html
func (a Aggregations) Min(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Max returns max aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-max-aggregation.html
func (a Aggregations) Max(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Sum returns sum aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-sum-aggregation.html
func (a Aggregations) Sum(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Avg returns average aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-avg-aggregation.html
func (a Aggregations) Avg(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// ValueCount returns value-count aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-valuecount-aggregation.html
func (a Aggregations) ValueCount(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Cardinality returns cardinality aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-cardinality-aggregation.html
func (a Aggregations) Cardinality(name string) (*AggregationValueMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationValueMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Stats returns stats aggregation results.
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-stats-aggregation.html
func (a Aggregations) Stats(name string) (*AggregationStatsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationStatsMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// ExtendedStats returns extended stats aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-extendedstats-aggregation.html
func (a Aggregations) ExtendedStats(name string) (*AggregationExtendedStatsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationExtendedStatsMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Percentiles returns percentiles results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-percentile-aggregation.html
func (a Aggregations) Percentiles(name string) (*AggregationPercentilesMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPercentilesMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// PercentileRanks returns percentile ranks results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-percentile-rank-aggregation.html
func (a Aggregations) PercentileRanks(name string) (*AggregationPercentilesMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationPercentilesMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// TopHits returns top-hits aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-top-hits-aggregation.html
func (a Aggregations) TopHits(name string) (*AggregationTopHitsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationTopHitsMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Global returns global results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-global-aggregation.html
func (a Aggregations) Global(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Filter returns filter results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-filter-aggregation.html
func (a Aggregations) Filter(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Filters returns filters results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-filters-aggregation.html
func (a Aggregations) Filters(name string) (*AggregationBucketFilters, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketFilters)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Missing returns missing results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-missing-aggregation.html
func (a Aggregations) Missing(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Nested returns nested results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-nested-aggregation.html
func (a Aggregations) Nested(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// ReverseNested returns reverse-nested results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-reverse-nested-aggregation.html
func (a Aggregations) ReverseNested(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Children returns children results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-children-aggregation.html
func (a Aggregations) Children(name string) (*AggregationSingleBucket, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationSingleBucket)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Terms returns terms aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html
func (a Aggregations) Terms(name string) (*AggregationBucketKeyItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketKeyItems)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// SignificantTerms returns significant terms aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-significantterms-aggregation.html
func (a Aggregations) SignificantTerms(name string) (*AggregationBucketSignificantTerms, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketSignificantTerms)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Range returns range aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-range-aggregation.html
func (a Aggregations) Range(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// DateRange returns date range aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-daterange-aggregation.html
func (a Aggregations) DateRange(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// IPv4Range returns IPv4 range aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-iprange-aggregation.html
func (a Aggregations) IPv4Range(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// Histogram returns histogram aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-histogram-aggregation.html
func (a Aggregations) Histogram(name string) (*AggregationBucketHistogramItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketHistogramItems)
		if err := json.Unmarshal(raw, &agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// DateHistogram returns date histogram aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html
func (a Aggregations) DateHistogram(name string) (*AggregationBucketHistogramItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketHistogramItems)
		if err := json.Unmarshal(raw, &agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// GeoBounds returns geo-bounds aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-geobounds-aggregation.html
func (a Aggregations) GeoBounds(name string) (*AggregationGeoBoundsMetric, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationGeoBoundsMetric)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// GeoHash returns geo-hash aggregation results.
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-geohashgrid-aggregation.html
func (a Aggregations) GeoHash(name string) (*AggregationBucketKeyItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketKeyItems)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// GeoDistance returns geo distance aggregation results.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-geodistance-aggregation.html
func (a Aggregations) GeoDistance(name string) (*AggregationBucketRangeItems, bool) {
	if raw, found := a[name]; found {
		agg := new(AggregationBucketRangeItems)
		if err := json.Unmarshal(raw, agg); err == nil {
			return agg, true
		}
	}
	return nil, false
}

// -- Single value metric --

// AggregationValueMetric is a single-value metric, returned e.g. by a
// Min or Max aggregation.
type AggregationValueMetric struct {
	Aggregations

	Value *float64 //`json:"value"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationValueMetric structure.
func (a *AggregationValueMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["value"], &a.Value)
	return nil
}

// -- Stats metric --

// AggregationStatsMetric is a multi-value metric, returned by a Stats aggregation.
type AggregationStatsMetric struct {
	Aggregations

	Count int64    // `json:"count"`
	Min   *float64 //`json:"min,omitempty"`
	Max   *float64 //`json:"max,omitempty"`
	Avg   *float64 //`json:"avg,omitempty"`
	Sum   *float64 //`json:"sum,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationStatsMetric structure.
func (a *AggregationStatsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["count"], &a.Count)
	json.Unmarshal(aggs["min"], &a.Min)
	json.Unmarshal(aggs["max"], &a.Max)
	json.Unmarshal(aggs["avg"], &a.Avg)
	json.Unmarshal(aggs["sum"], &a.Sum)
	return nil
}

// -- Extended stats metric --

// AggregationExtendedStatsMetric is a multi-value metric, returned by an ExtendedStats aggregation.
type AggregationExtendedStatsMetric struct {
	Aggregations

	Count        int64    // `json:"count"`
	Min          *float64 //`json:"min,omitempty"`
	Max          *float64 //`json:"max,omitempty"`
	Avg          *float64 //`json:"avg,omitempty"`
	Sum          *float64 //`json:"sum,omitempty"`
	SumOfSquares *float64 //`json:"sum_of_squares,omitempty"`
	Variance     *float64 //`json:"variance,omitempty"`
	StdDeviation *float64 //`json:"std_deviation,omitempty"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationExtendedStatsMetric structure.
func (a *AggregationExtendedStatsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["count"], &a.Count)
	json.Unmarshal(aggs["min"], &a.Min)
	json.Unmarshal(aggs["max"], &a.Max)
	json.Unmarshal(aggs["avg"], &a.Avg)
	json.Unmarshal(aggs["sum"], &a.Sum)
	json.Unmarshal(aggs["sum_of_squares"], &a.SumOfSquares)
	json.Unmarshal(aggs["variance"], &a.Variance)
	json.Unmarshal(aggs["std_deviation"], &a.StdDeviation)
	return nil
}

// -- Percentiles metric --

// AggregationPercentilesMetric is a multi-value metric, returned by a Percentiles aggregation.
type AggregationPercentilesMetric struct {
	Aggregations

	Values map[string]float64 // `json:"values"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationPercentilesMetric structure.
func (a *AggregationPercentilesMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["values"], &a.Values)
	return nil
}

// -- Top-hits metric --

// AggregationTopHitsMetric is a metric returned by a TopHits aggregation.
type AggregationTopHitsMetric struct {
	Aggregations

	Hits *SearchHits //`json:"hits"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationTopHitsMetric structure.
func (a *AggregationTopHitsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs
	a.Hits = new(SearchHits)
	json.Unmarshal(aggs["hits"], &a.Hits)
	return nil
}

// -- Geo-bounds metric --

// AggregationGeoBoundsMetric is a metric as returned by a GeoBounds aggregation.
type AggregationGeoBoundsMetric struct {
	Aggregations

	Bounds struct {
		TopLeft struct {
			Latitude  float64 `json:"lat"`
			Longitude float64 `json:"lon"`
		} `json:"top_left"`
		BottomRight struct {
			Latitude  float64 `json:"lat"`
			Longitude float64 `json:"lon"`
		} `json:"bottom_right"`
	} `json:"bounds"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationGeoBoundsMetric structure.
func (a *AggregationGeoBoundsMetric) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["bounds"], &a.Bounds)
	return nil
}

// -- Single bucket --

// AggregationSingleBucket is a single bucket, returned e.g. via an aggregation of type Global.
type AggregationSingleBucket struct {
	Aggregations

	DocCount int64 // `json:"doc_count"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationSingleBucket structure.
func (a *AggregationSingleBucket) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["doc_count"], &a.DocCount)
	return nil
}

// -- Bucket range items --

// AggregationBucketRangeItems is a bucket aggregation that is e.g. returned
// with a range aggregation.
type AggregationBucketRangeItems struct {
	Aggregations

	DocCountErrorUpperBound int64                         //`json:"doc_count_error_upper_bound"`
	SumOfOtherDocCount      int64                         //`json:"sum_other_doc_count"`
	Buckets                 []*AggregationBucketRangeItem //`json:"buckets"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketRangeItems structure.
func (a *AggregationBucketRangeItems) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["doc_count_error_upper_bound"], &a.DocCountErrorUpperBound)
	json.Unmarshal(aggs["sum_other_doc_count"], &a.SumOfOtherDocCount)
	json.Unmarshal(aggs["buckets"], &a.Buckets)
	return nil
}

// AggregationBucketRangeItem is a single bucket of an AggregationBucketRangeItems structure.
type AggregationBucketRangeItem struct {
	Aggregations

	Key          string   //`json:"key"`
	DocCount     int64    //`json:"doc_count"`
	From         *float64 //`json:"from"`
	FromAsString string   //`json:"from_as_string"`
	To           *float64 //`json:"to"`
	ToAsString   string   //`json:"to_as_string"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketRangeItem structure.
func (a *AggregationBucketRangeItem) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["key"], &a.Key)
	json.Unmarshal(aggs["doc_count"], &a.DocCount)
	json.Unmarshal(aggs["from"], &a.From)
	json.Unmarshal(aggs["from_as_string"], &a.FromAsString)
	json.Unmarshal(aggs["to"], &a.To)
	json.Unmarshal(aggs["to_as_string"], &a.ToAsString)
	return nil
}

// -- Bucket key items --

// AggregationBucketKeyItems is a bucket aggregation that is e.g. returned
// with a terms aggregation.
type AggregationBucketKeyItems struct {
	Aggregations

	DocCountErrorUpperBound int64                       //`json:"doc_count_error_upper_bound"`
	SumOfOtherDocCount      int64                       //`json:"sum_other_doc_count"`
	Buckets                 []*AggregationBucketKeyItem //`json:"buckets"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketKeyItems structure.
func (a *AggregationBucketKeyItems) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["doc_count_error_upper_bound"], &a.DocCountErrorUpperBound)
	json.Unmarshal(aggs["sum_other_doc_count"], &a.SumOfOtherDocCount)
	json.Unmarshal(aggs["buckets"], &a.Buckets)
	return nil
}

// AggregationBucketKeyItem is a single bucket of an AggregationBucketKeyItems structure.
type AggregationBucketKeyItem struct {
	Aggregations

	Key       interface{} //`json:"key"`
	KeyNumber json.Number
	DocCount  int64 //`json:"doc_count"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketKeyItem structure.
func (a *AggregationBucketKeyItem) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	if err := dec.Decode(&aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["key"], &a.Key)
	json.Unmarshal(aggs["key"], &a.KeyNumber)
	json.Unmarshal(aggs["doc_count"], &a.DocCount)
	return nil
}

// -- Bucket types for significant terms --

// AggregationBucketSignificantTerms is a bucket aggregation returned
// with a significant terms aggregation.
type AggregationBucketSignificantTerms struct {
	Aggregations

	DocCount int64                               //`json:"doc_count"`
	Buckets  []*AggregationBucketSignificantTerm //`json:"buckets"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketSignificantTerms structure.
func (a *AggregationBucketSignificantTerms) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["doc_count"], &a.DocCount)
	json.Unmarshal(aggs["buckets"], &a.Buckets)
	return nil
}

// AggregationBucketSignificantTerm is a single bucket of an AggregationBucketSignificantTerms structure.
type AggregationBucketSignificantTerm struct {
	Aggregations

	Key      string  //`json:"key"`
	DocCount int64   //`json:"doc_count"`
	BgCount  int64   //`json:"bg_count"`
	Score    float64 //`json:"score"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketSignificantTerm structure.
func (a *AggregationBucketSignificantTerm) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["key"], &a.Key)
	json.Unmarshal(aggs["doc_count"], &a.DocCount)
	json.Unmarshal(aggs["bg_count"], &a.BgCount)
	json.Unmarshal(aggs["score"], &a.Score)
	return nil
}

// -- Bucket filters --

// AggregationBucketFilters is a multi-bucket aggregation that is returned
// with a filters aggregation.
type AggregationBucketFilters struct {
	Aggregations

	Buckets      []*AggregationBucketKeyItem          //`json:"buckets"`
	NamedBuckets map[string]*AggregationBucketKeyItem //`json:"buckets"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketFilters structure.
func (a *AggregationBucketFilters) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["buckets"], &a.Buckets)
	json.Unmarshal(aggs["buckets"], &a.NamedBuckets)
	return nil
}

// -- Bucket histogram items --

// AggregationBucketHistogramItems is a bucket aggregation that is returned
// with a date histogram aggregation.
type AggregationBucketHistogramItems struct {
	Aggregations

	Buckets []*AggregationBucketHistogramItem //`json:"buckets"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketHistogramItems structure.
func (a *AggregationBucketHistogramItems) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["buckets"], &a.Buckets)
	return nil
}

// AggregationBucketHistogramItem is a single bucket of an AggregationBucketHistogramItems structure.
type AggregationBucketHistogramItem struct {
	Aggregations

	Key         int64   //`json:"key"`
	KeyAsString *string //`json:"key_as_string"`
	DocCount    int64   //`json:"doc_count"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketHistogramItem structure.
func (a *AggregationBucketHistogramItem) UnmarshalJSON(data []byte) error {
	var aggs map[string]json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	a.Aggregations = aggs

	json.Unmarshal(aggs["key"], &a.Key)
	json.Unmarshal(aggs["key_as_string"], &a.KeyAsString)
	json.Unmarshal(aggs["doc_count"], &a.DocCount)
	return nil
}

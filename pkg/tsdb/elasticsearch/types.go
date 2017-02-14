package elasticsearch

import "encoding/json"

// BucketAggregate is the elasticsearch aggregate bucket
type BucketAggregate struct {
	Field    string                 `json:"field"`
	ID       string                 `json:"id"`
	Settings map[string]interface{} `json:"settings"`
	Type     string                 `jsons:"type"`
}

// Metric defines the metric being requested from elasticsearch
type Metric struct {
	Field             string                 `json:"field"`
	ID                string                 `json:"id"`
	Meta              interface{}            `json:"meta"`
	PipelineAggregate string                 `json:"pipelineAgg"`
	Settings          map[string]interface{} `json:"settings"`
	Type              string                 `json:"type"`
}

// RequestModel is used to create an elasticsearch _search request
type RequestModel struct {
	BucketAggregates []BucketAggregate `json:"bucketAggs"`
	DatasourceType   string            `json:"dsType"`
	Metrics          []Metric          `json:"metrics"`
	Query            string            `json:"query"`
	RefID            string            `json:"refId"`
	TimeField        string            `json:"timeField"`
}

// ResponseBuckets provides access to the buckets
type ResponseBuckets struct {
	Buckets []*AggregationBucketRangeItem
}

// Response simple Elasticsearch response struct to access the buckets
type Response struct {
	Aggregations map[string]ResponseBuckets
}

// ******************************************************************************
//
// The types below are imported from the github.com/olivere es library; since
// we don't need all the other bloat from the library, the simpliset thing to do is
// just bring in these three types and the Unmarshallers associated
//
// Credit: https://github.com/olivere/elastic/blob/release-branch.v5/search_aggs.go
// The MIT License (MIT)

// Aggregations is a list of aggregations that are part of a search result.
type Aggregations map[string]*json.RawMessage

// AggregationBucketRangeItem is a single bucket of an AggregationBucketRangeItems structure.
type AggregationBucketRangeItem struct {
	Aggregations

	Key          string   `json:"key"`
	DocCount     int64    `json:"doc_count"`
	From         *float64 `json:"from"`
	FromAsString string   `json:"from_as_string"`
	To           *float64 `json:"to"`
	ToAsString   string   `json:"to_as_string"`
}

// UnmarshalJSON decodes JSON data and initializes an AggregationBucketRangeItem structure.
func (a *AggregationBucketRangeItem) UnmarshalJSON(data []byte) error {
	var aggs map[string]*json.RawMessage
	if err := json.Unmarshal(data, &aggs); err != nil {
		return err
	}
	if v, ok := aggs["key"]; ok && v != nil {
		json.Unmarshal(*v, &a.Key)
	}
	if v, ok := aggs["doc_count"]; ok && v != nil {
		json.Unmarshal(*v, &a.DocCount)
	}
	if v, ok := aggs["from"]; ok && v != nil {
		json.Unmarshal(*v, &a.From)
	}
	if v, ok := aggs["from_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.FromAsString)
	}
	if v, ok := aggs["to"]; ok && v != nil {
		json.Unmarshal(*v, &a.To)
	}
	if v, ok := aggs["to_as_string"]; ok && v != nil {
		json.Unmarshal(*v, &a.ToAsString)
	}
	a.Aggregations = aggs
	return nil
}

// ******************************************************************************

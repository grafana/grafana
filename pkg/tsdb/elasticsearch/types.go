package elasticsearch

import (
	elastic "gopkg.in/olivere/elastic.v3"
)

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
	Buckets []*elastic.AggregationBucketRangeItem
}

// Response simple Elasticsearch response struct to access the buckets
type Response struct {
	Aggregations map[string]ResponseBuckets
}

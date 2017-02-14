package elasticsearch

import (
	elastic "gopkg.in/olivere/elastic.v3"
)

type BucketAggregate struct {
	Field    string                 `json:"field"`
	Id       string                 `json:"id"`
	Settings map[string]interface{} `json:"settings"`
	Type     string                 `jsons:"type"`
}

type ElasticsearchMetric struct {
	Field             string                 `json:"field"`
	Id                string                 `json:"id"`
	Meta              interface{}            `json:"meta"`
	PipelineAggregate string                 `json:"pipelineAgg"`
	Settings          map[string]interface{} `json:"settings"`
	Type              string                 `json:"type"`
}

type ElasticsearchRequestModel struct {
	BucketAggregates []BucketAggregate     `json:"bucketAggs"`
	DatasourceType   string                `json:"dsType"`
	Metrics          []ElasticsearchMetric `json:"metrics"`
	Query            string                `json:"query"`
	RefId            string                `json:"refId"`
	TimeField        string                `json:"timeField"`
}

type ElasticsearchResponseBuckets struct {
	Buckets []*elastic.AggregationBucketRangeItem
}

type ElasticsearchResponse struct {
	Aggregations map[string]ElasticsearchResponseBuckets
}

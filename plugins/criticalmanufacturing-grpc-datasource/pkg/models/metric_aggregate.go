package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type MetricAggregateQuery struct {
	MetricBaseQuery
	Aggregations []Aggregation `json:"aggregations"`
	OrderBy      []OrderBy     `json:"orders"`
}

type Aggregation struct {
	AggregationType  string   `json:"type"`
	AggregatedFields []string `json:"fields"`
	Alias            string   `json:"alias"`
}

type OrderBy struct {
	Field      string `json:"field"`
	Expression string `json:"direction"`
}

func UnmarshalToMetricAggregateQuery(dq *backend.DataQuery) (*MetricAggregateQuery, error) {
	query := &MetricAggregateQuery{}
	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	// add on the DataQuery params
	query.TimeRange = dq.TimeRange
	query.Interval = dq.Interval
	query.QueryType = dq.QueryType

	return query, nil
}

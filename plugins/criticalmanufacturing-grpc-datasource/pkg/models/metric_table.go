package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type MetricTableQuery struct {
	MetricBaseQuery
	OrderBy []OrderBy `json:"orders"`
}

func UnmarshalToMetricTableQuery(dq *backend.DataQuery) (*MetricTableQuery, error) {
	query := &MetricTableQuery{}
	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	// add on the DataQuery params
	query.QueryType = dq.QueryType

	return query, nil
}

package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type MetricValueQuery struct {
	MetricBaseQuery
}

func UnmarshalToMetricValueQuery(dq *backend.DataQuery) (*MetricValueQuery, error) {
	query := &MetricValueQuery{}
	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	// add on the DataQuery params
	query.TimeRange = dq.TimeRange
	query.Interval = dq.Interval
	query.QueryType = dq.QueryType

	return query, nil
}

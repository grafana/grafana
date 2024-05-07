package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type MetricHistoryQuery struct {
	MetricBaseQuery
}

func UnmarshalToMetricHistoryQuery(dq *backend.DataQuery) (*MetricHistoryQuery, error) {
	query := &MetricHistoryQuery{}
	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	// add on the DataQuery params
	query.TimeRange = dq.TimeRange
	query.Interval = dq.Interval
	query.QueryType = dq.QueryType

	return query, nil
}

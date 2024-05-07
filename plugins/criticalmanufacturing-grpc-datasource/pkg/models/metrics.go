package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type MetricsQuery struct {
	Dimensions []Dimension `json:"dimensions"`
	Dataset    string      `json:"dataset"`
}

func UnmarshalToMetricsQuery(dq *backend.DataQuery) (*MetricsQuery, error) {
	query := &MetricsQuery{}
	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	return query, nil
}

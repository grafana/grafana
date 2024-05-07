package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type DimensionValuesQuery struct {
	DimensionKey string `json:"dimensionKey"`
	Filter       string `json:"filter"`
	Dataset      string `json:"dataset"`
}

func UnmarshalToDimensionValuesQuery(dq *backend.DataQuery) (*DimensionValuesQuery, error) {
	query := &DimensionValuesQuery{}
	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	return query, nil
}

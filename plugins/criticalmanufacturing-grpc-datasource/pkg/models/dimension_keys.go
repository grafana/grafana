package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type DimensionKeysQuery struct {
	Dataset string `json:"dataset"`
}

func UnmarshalToDimensionKeysQuery(dq *backend.DataQuery) (*DimensionKeysQuery, error) {
	query := &DimensionKeysQuery{}
	backend.Logger.Info("UnmarshalToDimensionKeysQuery: " + string(dq.JSON))

	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	return query, nil
}

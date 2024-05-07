package models

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type DatasetsQuery struct {
}

func UnmarshalToDatasetsQuery(dq *backend.DataQuery) (*DatasetsQuery, error) {
	query := &DatasetsQuery{}
	if err := json.Unmarshal(dq.JSON, query); err != nil {
		return nil, err
	}

	return query, nil
}

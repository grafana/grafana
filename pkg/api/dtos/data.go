package dtos

import "github.com/grafana/grafana/pkg/components/simplejson"

// DataQuery data query dto
type DataQuery struct {
	DatasourceID   int64            `json:"datasourceId"`
	DatasourceName string           `json:"datasourceName"`
	RefID          string           `json:"refId"`
	From           string           `json:"from"`
	To             string           `json:"to"`
	MaxDataPoints  *int64           `json:"maxDataPoints"`
	IntervalMS     *int64           `json:"intervalMs"`
	Model          *simplejson.Json `json:"model"`
}

// QueryDataRequest request dto for querying data
type QueryDataRequest struct {
	Queries []*DataQuery `json:"queries"`
}

// TransformDataRequest request dto for transforming data
type TransformDataRequest struct {
	Queries []*DataQuery `json:"queries"`
}

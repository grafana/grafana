package dtos

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AddToQueryHistoryCmd struct {
	DatasourceUid string           `json:"datasourceUid"`
	Queries       *simplejson.Json `json:"queries"`
}

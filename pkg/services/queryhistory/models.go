package queryhistory

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

type QueryHistory struct {
	Id            int64            `json:"id"`
	Uid           string           `json:"uid"`
	DatasourceUid string           `json:"datasourceUid"`
	OrgId         int64            `json:"orgId"`
	CreatedBy     int64            `json:"createdBy"`
	CreatedAt     int64            `json:"createdAt"`
	Comment       string           `json:"comment"`
	Queries       *simplejson.Json `json:"queries"`
}

type CreateQueryInQueryHistoryCommand struct {
	DatasourceUid string           `json:"datasourceUid"`
	Queries       *simplejson.Json `json:"queries"`
}

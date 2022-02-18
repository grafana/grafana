package queryhistory

import (
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrQueryNotFound = errors.New("query in query history not found")
)

type QueryHistory struct {
	ID            int64  `xorm:"pk autoincr 'id'"`
	UID           string `xorm:"uid"`
	DatasourceUID string `xorm:"datasource_uid"`
	OrgID         int64  `xorm:"org_id"`
	CreatedBy     int64
	CreatedAt     int64
	Comment       string
	Queries       *simplejson.Json
}

type CreateQueryInQueryHistoryCommand struct {
	DatasourceUID string           `json:"datasourceUid"`
	Queries       *simplejson.Json `json:"queries"`
}

type PatchQueryCommentInQueryHistoryCommand struct {
	Comment string `json:"comment"`
}

type QueryHistoryDTO struct {
	UID           string           `json:"uid"`
	DatasourceUID string           `json:"datasourceUid"`
	CreatedBy     int64            `json:"createdBy"`
	CreatedAt     int64            `json:"createdAt"`
	Comment       string           `json:"comment"`
	Queries       *simplejson.Json `json:"queries"`
	Starred       bool             `json:"starred"`
}

// QueryHistoryResponse is a response struct for QueryHistoryDTO
type QueryHistoryResponse struct {
	Result QueryHistoryDTO `json:"result"`
}

// DeleteQueryFromQueryHistoryResponse is the response struct for deleting a query from query history
type DeleteQueryFromQueryHistoryResponse struct {
	ID      int64  `json:"id"`
	Message string `json:"message"`
}

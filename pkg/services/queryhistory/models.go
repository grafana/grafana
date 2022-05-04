package queryhistory

import (
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrQueryNotFound        = errors.New("query in query history not found")
	ErrStarredQueryNotFound = errors.New("starred query not found")
	ErrQueryAlreadyStarred  = errors.New("query was already starred")
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

type QueryHistoryStar struct {
	ID       int64  `xorm:"pk autoincr 'id'"`
	QueryUID string `xorm:"query_uid"`
	UserID   int64  `xorm:"user_id"`
}

type CreateQueryInQueryHistoryCommand struct {
	DatasourceUID string           `json:"datasourceUid"`
	Queries       *simplejson.Json `json:"queries"`
}

type SearchInQueryHistoryQuery struct {
	DatasourceUIDs []string `json:"datasourceUids"`
	SearchString   string   `json:"searchString"`
	OnlyStarred    bool     `json:"onlyStarred"`
	Sort           string   `json:"sort"`
	Page           int      `json:"page"`
	Limit          int      `json:"limit"`
	From           int64    `json:"from"`
	To             int64    `json:"to"`
}

type PatchQueryCommentInQueryHistoryCommand struct {
	Comment string `json:"comment"`
}

type QueryHistoryDTO struct {
	UID           string           `json:"uid" xorm:"uid"`
	DatasourceUID string           `json:"datasourceUid" xorm:"datasource_uid"`
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

type QueryHistorySearchResult struct {
	TotalCount   int               `json:"totalCount"`
	QueryHistory []QueryHistoryDTO `json:"queryHistory"`
	Page         int               `json:"page"`
	PerPage      int               `json:"perPage"`
}

type QueryHistorySearchResponse struct {
	Result QueryHistorySearchResult `json:"result"`
}

// DeleteQueryFromQueryHistoryResponse is the response struct for deleting a query from query history
type DeleteQueryFromQueryHistoryResponse struct {
	ID      int64  `json:"id"`
	Message string `json:"message"`
}

type MigrateQueriesToQueryHistoryCommand struct {
	Queries []QueryToMigrate `json:"queries"`
}

type QueryToMigrate struct {
	DatasourceUID string           `json:"datasourceUid"`
	Queries       *simplejson.Json `json:"queries"`
	CreatedAt     int64            `json:"createdAt"`
	Comment       string           `json:"comment"`
	Starred       bool             `json:"starred"`
}

type QueryHistoryMigrationResponse struct {
	Message      string `json:"message"`
	TotalCount   int    `json:"totalCount"`
	StarredCount int    `json:"starredCount"`
}

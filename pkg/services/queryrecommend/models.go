package queryrecommend

import (
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrQueryNotFound        = errors.New("query in query history not found")
	ErrStarredQueryNotFound = errors.New("starred query not found")
	ErrQueryAlreadyStarred  = errors.New("query was already starred")
)

// QueryRecommendation is the model for query recommendation definitions
type QueryRecommendation struct {
	ID            int64  `xorm:"pk autoincr 'id'"`
	UID           string `xorm:"uid"`
	DatasourceUID string `xorm:"datasource_uid"`
	OrgID         int64  `xorm:"org_id"`
	CreatedBy     int64
	CreatedAt     int64
	Comment       string
	Queries       *simplejson.Json
}

// QueryRecommend is the model for query history star definitions
type QueryRecommendStar struct {
	ID       int64  `xorm:"pk autoincr 'id'"`
	QueryUID string `xorm:"query_uid"`
	UserID   int64  `xorm:"user_id"`
}

type SearchInQueryRecommendQuery struct {
	DatasourceUIDs []string `json:"datasourceUids"`
	SearchString   string   `json:"searchString"`
	OnlyStarred    bool     `json:"onlyStarred"`
	Sort           string   `json:"sort"`
	Page           int      `json:"page"`
	Limit          int      `json:"limit"`
	From           int64    `json:"from"`
	To             int64    `json:"to"`
}

type QueryHistoryDTO struct {
	UID           string           `json:"uid" xorm:"uid"`
	DatasourceUID string           `json:"datasourceUid" xorm:"datasource_uid"`
	CreatedBy     int64            `json:"createdBy"`
	CreatedAt     int64            `json:"createdAt"`
	Comment       string           `json:"comment"`
	Queries       *simplejson.Json `json:"queries"`
	Starred       bool             `json:"starred"`
	TemplatedExpr string           `json:"templatedExpr"`
}

type QueryRecommendDTO struct {
	Metric           string         `json:"metric"`
	TemplatedExpr    string         `json:"templatedExpr"`
	Count            int            `json:"count"`
	TopLabelValues   map[string]int `json:"topLabelValues"`
	TopLabelNoValues map[string]int `json:"topLabelNoValues"`
	CreatedAt        int64          `json:"createdAt"`
}

// QueryRecommendResponse is a response struct for QueryRecommendDTO
type QueryRecommendResponse struct {
	Result []QueryRecommendDTO `json:"result"`
}

type QueryRecommendSearchResult struct {
	TotalCount     int                 `json:"totalCount"`
	QueryRecommend []QueryRecommendDTO `json:"QueryRecommend"`
	Page           int                 `json:"page"`
	PerPage        int                 `json:"perPage"`
}

type QueryRecommendSearchResponse struct {
	Result QueryRecommendSearchResult `json:"result"`
}

// QueryRecommendDeleteQueryResponse is the response struct for deleting a query from query history
type QueryGenerateRecommendResponse struct {
	Message string `json:"message"`
}

// CreateQueryInQueryRecommendCommand is the command for adding query history
// swagger:model
type CreateQueryInQueryRecommendCommand struct {
	// UID of the data source for which are queries stored.
	// example: PE1C5CBDA0504A6A3
	DatasourceUID string `json:"datasourceUid"`
	// The JSON model of queries.
	// required: true
	Queries *simplejson.Json `json:"queries"`
}

// PatchQueryCommentInQueryRecommendCommand is the command for updating comment for query in query history
// swagger:model
type PatchQueryCommentInQueryRecommendCommand struct {
	// Updated comment
	Comment string `json:"comment"`
}

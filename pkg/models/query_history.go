package models

import (
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

var (
	ErrQueryNotFound        = errors.New("query not found")
	ErrStarredQueryNotFound = errors.New("starred query not found")
	ErrQueryAlreadyStarred  = errors.New("query already starred")
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

type QueryHistoryStar struct {
	Id       int64
	QueryUid string
	UserId   int64
}

type QueryHistorySearch struct {
	DatasourceUids []string
	SearchString   string
	OnlyStarred    bool
	Sort           string
	Page           int
	Limit          int
}

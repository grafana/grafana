package models

import (
	"errors"
)

var (
	ErrQueryNotFound        = errors.New("query not found")
	ErrStarredQueryNotFound = errors.New("starred query not found")
)

type QueryHistory struct {
	Id            int64  `json:"id"`
	Uid           string `json:"uid"`
	DatasourceUid string `json:"datasourceUid"`
	OrgId         int64  `json:"orgId"`
	CreatedBy     int64  `json:"createdBy"`
	CreatedAt     int64  `json:"createdAt"`
	Comment       string `json:"comment"`
	Queries       string `json:"queries"`
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
}

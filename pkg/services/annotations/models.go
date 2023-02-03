package annotations

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/user"
)

type ItemQuery struct {
	OrgID        int64    `json:"orgId"`
	From         int64    `json:"from"`
	To           int64    `json:"to"`
	UserID       int64    `json:"userId"`
	AlertID      int64    `json:"alertId"`
	DashboardID  int64    `json:"dashboardId"`
	DashboardUID string   `json:"dashboardUID"`
	PanelID      int64    `json:"panelId"`
	AnnotationID int64    `json:"annotationId"`
	Tags         []string `json:"tags"`
	Type         string   `json:"type"`
	MatchAny     bool     `json:"matchAny"`
	SignedInUser *user.SignedInUser

	Limit int64 `json:"limit"`
}

// TagsQuery is the query for a tags search.
type TagsQuery struct {
	OrgID int64  `json:"orgId"`
	Tag   string `json:"tag"`

	Limit int64 `json:"limit"`
}

// Tag is the DB result of a tags search.
type Tag struct {
	Key   string
	Value string
	Count int64
}

// TagsDTO is the frontend DTO for Tag.
type TagsDTO struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

// FindTagsResult is the result of a tags search.
type FindTagsResult struct {
	Tags []*TagsDTO `json:"tags"`
}

// GetAnnotationTagsResponse is a response struct for FindTagsResult.
type GetAnnotationTagsResponse struct {
	Result FindTagsResult `json:"result"`
}

type DeleteParams struct {
	OrgID       int64
	ID          int64
	DashboardID int64
	PanelID     int64
}

type Item struct {
	ID          int64            `json:"id" xorm:"pk autoincr 'id'"`
	OrgID       int64            `json:"orgId" xorm:"org_id"`
	UserID      int64            `json:"userId" xorm:"user_id"`
	DashboardID int64            `json:"dashboardId" xorm:"dashboard_id"`
	PanelID     int64            `json:"panelId" xorm:"panel_id"`
	Text        string           `json:"text"`
	AlertID     int64            `json:"alertId" xorm:"alert_id"`
	PrevState   string           `json:"prevState"`
	NewState    string           `json:"newState"`
	Epoch       int64            `json:"epoch"`
	EpochEnd    int64            `json:"epochEnd"`
	Created     int64            `json:"created"`
	Updated     int64            `json:"updated"`
	Tags        []string         `json:"tags"`
	Data        *simplejson.Json `json:"data"`

	// needed until we remove it from db
	Type  string
	Title string
}

func (i Item) TableName() string {
	return "annotation"
}

type ItemDTO struct {
	ID           int64            `json:"id" xorm:"id"`
	AlertID      int64            `json:"alertId" xorm:"alert_id"`
	AlertName    string           `json:"alertName"`
	DashboardID  int64            `json:"dashboardId" xorm:"dashboard_id"`
	DashboardUID *string          `json:"dashboardUID" xorm:"dashboard_uid"`
	PanelID      int64            `json:"panelId" xorm:"panel_id"`
	UserID       int64            `json:"userId" xorm:"user_id"`
	NewState     string           `json:"newState"`
	PrevState    string           `json:"prevState"`
	Created      int64            `json:"created"`
	Updated      int64            `json:"updated"`
	Time         int64            `json:"time"`
	TimeEnd      int64            `json:"timeEnd"`
	Text         string           `json:"text"`
	Tags         []string         `json:"tags"`
	Login        string           `json:"login"`
	Email        string           `json:"email"`
	AvatarURL    string           `json:"avatarUrl" xorm:"avatar_url"`
	Data         *simplejson.Json `json:"data"`
}

type annotationType int

const (
	Organization annotationType = iota
	Dashboard
)

func (a annotationType) String() string {
	switch a {
	case Organization:
		return "organization"
	case Dashboard:
		return "dashboard"
	default:
		return ""
	}
}

func (annotation *ItemDTO) GetType() annotationType {
	if annotation.DashboardID != 0 {
		return Dashboard
	}
	return Organization
}

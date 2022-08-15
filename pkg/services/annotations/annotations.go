package annotations

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrTimerangeMissing = errors.New("missing timerange")
)

type Repository interface {
	Save(item *Item) error
	Update(ctx context.Context, item *Item) error
	Find(ctx context.Context, query *ItemQuery) ([]*ItemDTO, error)
	Delete(ctx context.Context, params *DeleteParams) error
	FindTags(ctx context.Context, query *TagsQuery) (FindTagsResult, error)
}

// AnnotationCleaner is responsible for cleaning up old annotations
type AnnotationCleaner interface {
	CleanAnnotations(ctx context.Context, cfg *setting.Cfg) (int64, int64, error)
}

type ItemQuery struct {
	OrgId        int64    `json:"orgId"`
	From         int64    `json:"from"`
	To           int64    `json:"to"`
	UserId       int64    `json:"userId"`
	AlertId      int64    `json:"alertId"`
	DashboardId  int64    `json:"dashboardId"`
	DashboardUid string   `json:"dashboardUID"`
	PanelId      int64    `json:"panelId"`
	AnnotationId int64    `json:"annotationId"`
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
	OrgId       int64
	Id          int64
	DashboardId int64
	PanelId     int64
}

var repositoryInstance Repository
var cleanerInstance AnnotationCleaner

func GetAnnotationCleaner() AnnotationCleaner {
	return cleanerInstance
}

func SetAnnotationCleaner(rep AnnotationCleaner) {
	cleanerInstance = rep
}

func GetRepository() Repository {
	return repositoryInstance
}

func SetRepository(rep Repository) {
	repositoryInstance = rep
}

type Item struct {
	Id          int64            `json:"id"`
	OrgId       int64            `json:"orgId"`
	UserId      int64            `json:"userId"`
	DashboardId int64            `json:"dashboardId"`
	PanelId     int64            `json:"panelId"`
	Text        string           `json:"text"`
	AlertId     int64            `json:"alertId"`
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
	Id           int64            `json:"id"`
	AlertId      int64            `json:"alertId"`
	AlertName    string           `json:"alertName"`
	DashboardId  int64            `json:"dashboardId"`
	DashboardUID *string          `json:"dashboardUID"`
	PanelId      int64            `json:"panelId"`
	UserId       int64            `json:"userId"`
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
	AvatarUrl    string           `json:"avatarUrl"`
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
	if annotation.DashboardId != 0 {
		return Dashboard
	}
	return Organization
}

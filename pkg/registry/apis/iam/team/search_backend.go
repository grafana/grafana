package team

import (
	"context"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

type SearchBackend interface {
	Search(context.Context, SearchQuery) (*iamv0.GetSearchTeamsResponse, error)
}

type SearchQuery struct {
	Namespace string
	Query     string
	Title     string
	UIDs      []string
	TeamIDs   []string
	Limit     int64
	Page      int64
	Offset    int64
	Sort      []string
}

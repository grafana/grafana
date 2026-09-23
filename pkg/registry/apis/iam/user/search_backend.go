package user

import (
	"context"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

type SearchBackend interface {
	Search(context.Context, SearchQuery) (*iamv0.GetSearchUsersResponse, error)
}

type SearchQuery struct {
	Namespace string
	Query     string
	Limit     int64
	Page      int64
	Offset    int64
	Sort      []string

	// Pointers distinguish a uniqueness lookup for an empty value from no filter.
	Email *string
	Login *string
}

// UserSortFieldMapping maps user-search sort fields to legacy SQL sort keys.
func UserSortFieldMapping() map[string]string {
	return map[string]string{
		"lastSeenAt": "lastSeenAtAge",
		"title":      "name",
		"login":      "login",
		"email":      "email",
	}
}

package user

import (
	"context"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

type UserTeamsBackend interface {
	ListUserTeams(context.Context, UserTeamsQuery) (*UserTeamsPage, error)
}

type UserTeamsQuery struct {
	Namespace string
	UserUID   string
	Limit     int64
	After     []string
	Explain   bool
}

type UserTeamsPage struct {
	Items []iamv0.GetUserTeamsUserTeam
	// Advance past all visited teams, including those whose membership disappeared.
	Next            []string
	ResourceVersion int64
}

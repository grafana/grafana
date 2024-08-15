package legacy

import (
	"context"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type ListUserQuery struct {
	OrgID            int64
	UID              string
	ContinueID       int64 // ContinueID
	Limit            int64
	IsServiceAccount bool
}

type ListUserResult struct {
	Users      []user.User
	ContinueID int64
	RV         int64
}

type ListTeamQuery struct {
	OrgID      int64
	UID        string
	ContinueID int64 // ContinueID
	Limit      int64
}

type ListTeamResult struct {
	Teams      []team.Team
	ContinueID int64
	RV         int64
}

type GetUserDisplayQuery struct {
	OrgID int64
	UIDs  []string
	IDs   []int64
}

// In every case, RBAC should be applied before calling, or before returning results to the requester
type LegacyIdentityStore interface {
	ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error)
	ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error)
	GetDisplay(ctx context.Context, ns claims.NamespaceInfo, query GetUserDisplayQuery) (*ListUserResult, error)
	GetUserTeams(ctx context.Context, ns claims.NamespaceInfo, uid string) ([]team.Team, error)
}

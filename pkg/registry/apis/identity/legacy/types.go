package legacy

import (
	"context"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

type GetUserDisplayQuery struct {
	OrgID int64
	UIDs  []string
	IDs   []int64
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

type TeamMember struct {
	ID         int64
	TeamID     int64
	TeamUID    string
	UserUID    string
	Updated    time.Time
	Created    time.Time
	Permission team.PermissionType
}

func (m TeamMember) MemberID() string {
	return identity.NewTypedIDString(claims.TypeUser, m.UserUID)
}

type TeamBinding struct {
	TeamUID string
	Members []TeamMember
}

type ListTeamBindingsQuery struct {
	// UID is team uid to list bindings for. If not set store should list bindings for all teams
	UID        string
	OrgID      int64
	ContinueID int64 // ContinueID
	Limit      int64
}

type ListTeamBindingsResult struct {
	Bindings   []TeamBinding
	ContinueID int64
	RV         int64
}

// In every case, RBAC should be applied before calling, or before returning results to the requester
type LegacyIdentityStore interface {
	ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error)
	GetDisplay(ctx context.Context, ns claims.NamespaceInfo, query GetUserDisplayQuery) (*ListUserResult, error)

	ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error)
	ListTeamBindings(ctx context.Context, ns claims.NamespaceInfo, query ListTeamBindingsQuery) (*ListTeamBindingsResult, error)

	GetUserTeams(ctx context.Context, ns claims.NamespaceInfo, uid string) ([]team.Team, error)
}

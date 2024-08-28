package legacy

import (
	"context"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/identity/common"
	"github.com/grafana/grafana/pkg/services/team"
)

type TeamMember struct {
	ID         int64
	TeamID     int64
	TeamUID    string
	UserID     int64
	UserUID    string
	Name       string
	Email      string
	Username   string
	External   bool
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
	Pagination common.Pagination
}

type ListTeamBindingsResult struct {
	Bindings []TeamBinding
	Continue int64
	RV       int64
}

type ListTeamMembersQuery struct {
	UID        string
	OrgID      int64
	Pagination common.Pagination
}

type ListTeamMembersResult struct {
	Continue int64
	Members  []TeamMember
}

// In every case, RBAC should be applied before calling, or before returning results to the requester
type LegacyIdentityStore interface {
	ListDisplay(ctx context.Context, ns claims.NamespaceInfo, query ListDisplayQuery) (*ListUserResult, error)

	ListUsers(ctx context.Context, ns claims.NamespaceInfo, query ListUserQuery) (*ListUserResult, error)

	ListTeams(ctx context.Context, ns claims.NamespaceInfo, query ListTeamQuery) (*ListTeamResult, error)
	ListTeamBindings(ctx context.Context, ns claims.NamespaceInfo, query ListTeamBindingsQuery) (*ListTeamBindingsResult, error)
	ListTeamMembers(ctx context.Context, ns claims.NamespaceInfo, query ListTeamMembersQuery) (*ListTeamMembersResult, error)

	GetUserTeams(ctx context.Context, ns claims.NamespaceInfo, uid string) ([]team.Team, error)
}

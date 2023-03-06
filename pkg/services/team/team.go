package team

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards"
)

type Service interface {
	CreateTeam(name, email string, orgID int64) (Team, error)
	UpdateTeam(ctx context.Context, cmd *UpdateTeamCommand) error
	DeleteTeam(ctx context.Context, cmd *DeleteTeamCommand) error
	SearchTeams(ctx context.Context, query *SearchTeamsQuery) (SearchTeamQueryResult, error)
	GetTeamByID(ctx context.Context, query *GetTeamByIDQuery) (*TeamDTO, error)
	GetTeamsByUser(ctx context.Context, query *GetTeamsByUserQuery) ([]*TeamDTO, error)
	AddTeamMember(userID, orgID, teamID int64, isExternal bool, permission dashboards.PermissionType) error
	UpdateTeamMember(ctx context.Context, cmd *UpdateTeamMemberCommand) error
	IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error)
	RemoveTeamMember(ctx context.Context, cmd *RemoveTeamMemberCommand) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*TeamMemberDTO, error)
	GetTeamMembers(ctx context.Context, query *GetTeamMembersQuery) ([]*TeamMemberDTO, error)
	IsAdminOfTeams(ctx context.Context, query *IsAdminOfTeamsQuery) (bool, error)
}

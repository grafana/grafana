package team

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
)

type Service interface {
	CreateTeam(name, email string, orgID int64) (Team, error)
	UpdateTeam(ctx context.Context, cmd *UpdateTeamCommand) error
	DeleteTeam(ctx context.Context, cmd *DeleteTeamCommand) error
	SearchTeams(ctx context.Context, query *SearchTeamsQuery) (SearchTeamQueryResult, error)
	GetTeamByID(ctx context.Context, query *GetTeamByIDQuery) (*TeamDTO, error)
	GetTeamsByUser(ctx context.Context, query *GetTeamsByUserQuery) ([]*TeamDTO, error)
	GetTeamIDsByUser(ctx context.Context, query *GetTeamIDsByUserQuery) ([]int64, error)
	AddTeamMember(ctx context.Context, userID, orgID, teamID int64, isExternal bool, permission dashboardaccess.PermissionType) error
	UpdateTeamMember(ctx context.Context, cmd *UpdateTeamMemberCommand) error
	IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error)
	RemoveTeamMember(ctx context.Context, cmd *RemoveTeamMemberCommand) error
	RemoveUsersMemberships(tx context.Context, userID int64) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*TeamMemberDTO, error)
	GetTeamMembers(ctx context.Context, query *GetTeamMembersQuery) ([]*TeamMemberDTO, error)
	RegisterDelete(query string)
}

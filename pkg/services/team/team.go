package team

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	CreateTeam(name, email string, orgID int64) (models.Team, error)
	UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error
	DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error
	SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error
	GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error
	GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error
	AddTeamMember(userID, orgID, teamID int64, isExternal bool, permission models.PermissionType) error
	UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error
	IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error)
	RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error)
	GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error
	IsAdminOfTeams(ctx context.Context, query *models.IsAdminOfTeamsQuery) error
}

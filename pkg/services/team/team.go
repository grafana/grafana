package team

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error
	DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error
	SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error
	GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error
	UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error
	RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error
	GetTeamMembers(ctx context.Context, cmd *models.GetTeamMembersQuery) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error)
}

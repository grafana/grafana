package team

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	Create(ctx context.Context, name, email string, orgID int64) (models.Team, error)
	Update(ctx context.Context, cmd *UpdateTeamCommand) error
	Delete(ctx context.Context, cmd *DeleteTeamCommand) error
	List(ctx context.Context, query *SearchTeamsQuery) (*SearchTeamQueryResult, error)
	ListByUser(ctx context.Context, query *GetTeamsByUserQuery) (*GetTeamsByUserQueryResult, error)
	GetById(ctx context.Context, query *GetTeamByIdQuery) error

	UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error
	RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error
	GetTeamMembers(ctx context.Context, cmd *models.GetTeamMembersQuery) error
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error)
}

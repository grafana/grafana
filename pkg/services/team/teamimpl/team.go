package teamimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
)

type Service struct {
	store *sqlstore.SQLStore
}

func ProvideService(sqlStore *sqlstore.SQLStore) team.Service {
	return &Service{store: sqlStore}
}

func (s *Service) CreateTeam(name, email string, orgID int64) (models.Team, error) {
	return s.store.CreateTeam(name, email, orgID)
}

func (s *Service) UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error {
	return s.store.UpdateTeam(ctx, cmd)
}

func (s *Service) DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error {
	return s.store.DeleteTeam(ctx, cmd)
}

func (s *Service) SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error {
	return s.store.SearchTeams(ctx, query)
}

func (s *Service) GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error {
	return s.store.GetTeamById(ctx, query)
}

func (s *Service) GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error {
	return s.store.GetTeamsByUser(ctx, query)
}

func (s *Service) AddTeamMember(userID, orgID, teamID int64, isExternal bool, permission models.PermissionType) error {
	return s.store.AddTeamMember(userID, orgID, teamID, isExternal, permission)
}

func (s *Service) UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error {
	return s.store.UpdateTeamMember(ctx, cmd)
}

func (s *Service) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	return s.store.IsTeamMember(orgId, teamId, userId)
}

func (s *Service) RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error {
	return s.store.RemoveTeamMember(ctx, cmd)
}

func (s *Service) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error) {
	return s.store.GetUserTeamMemberships(ctx, orgID, userID, external)
}

func (s *Service) GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error {
	return s.store.GetTeamMembers(ctx, query)
}

func (s *Service) IsAdminOfTeams(ctx context.Context, query *models.IsAdminOfTeamsQuery) error {
	return s.store.IsAdminOfTeams(ctx, query)
}

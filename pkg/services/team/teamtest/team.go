package teamtest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeService struct {
	ExpectedTeam        models.Team
	ExpectedTeamsByUser []*models.TeamDTO
	ExpectedMembers     []*models.TeamMemberDTO
	ExpectedError       error
}

func (s *FakeService) CreateTeam(name, email string, orgID int64) (models.Team, error) {
	return s.ExpectedTeam, s.ExpectedError
}

func (s *FakeService) UpdateTeam(ctx context.Context, cmd *models.UpdateTeamCommand) error {
	return s.ExpectedError
}

func (s *FakeService) DeleteTeam(ctx context.Context, cmd *models.DeleteTeamCommand) error {
	return s.ExpectedError
}

func (s *FakeService) SearchTeams(ctx context.Context, query *models.SearchTeamsQuery) error {
	return s.ExpectedError
}

func (s *FakeService) GetTeamById(ctx context.Context, query *models.GetTeamByIdQuery) error {
	return s.ExpectedError
}

func (s *FakeService) GetTeamsByUser(ctx context.Context, query *models.GetTeamsByUserQuery) error {
	query.Result = s.ExpectedTeamsByUser
	return s.ExpectedError
}

func (s *FakeService) AddTeamMember(userID, orgID, teamID int64, isExternal bool, permission models.PermissionType) error {
	return s.ExpectedError
}

func (s *FakeService) UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error {
	return s.ExpectedError
}

func (s *FakeService) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	return false, s.ExpectedError
}

func (s *FakeService) RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error {
	return s.ExpectedError
}

func (s *FakeService) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error) {
	return s.ExpectedMembers, s.ExpectedError
}

func (s *FakeService) GetTeamMembers(ctx context.Context, query *models.GetTeamMembersQuery) error {
	return s.ExpectedError
}

func (s *FakeService) IsAdminOfTeams(ctx context.Context, query *models.IsAdminOfTeamsQuery) error {
	return s.ExpectedError
}

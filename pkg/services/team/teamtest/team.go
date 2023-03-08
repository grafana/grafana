package teamtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/team"
)

type FakeService struct {
	ExpectedTeam        team.Team
	ExpectedIsMember    bool
	ExpectedIsAdmin     bool
	ExpectedTeamDTO     *team.TeamDTO
	ExpectedTeamsByUser []*team.TeamDTO
	ExpectedMembers     []*team.TeamMemberDTO
	ExpectedError       error
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

func (s *FakeService) CreateTeam(name, email string, orgID int64) (team.Team, error) {
	return s.ExpectedTeam, s.ExpectedError
}

func (s *FakeService) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	return s.ExpectedError
}

func (s *FakeService) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	return s.ExpectedError
}

func (s *FakeService) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	return team.SearchTeamQueryResult{}, s.ExpectedError
}

func (s *FakeService) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	return s.ExpectedTeamDTO, s.ExpectedError
}

func (s *FakeService) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	return s.ExpectedTeamsByUser, s.ExpectedError
}

func (s *FakeService) AddTeamMember(userID, orgID, teamID int64, isExternal bool, permission dashboards.PermissionType) error {
	return s.ExpectedError
}

func (s *FakeService) UpdateTeamMember(ctx context.Context, cmd *team.UpdateTeamMemberCommand) error {
	return s.ExpectedError
}

func (s *FakeService) IsTeamMember(orgId int64, teamId int64, userId int64) (bool, error) {
	return s.ExpectedIsMember, s.ExpectedError
}

func (s *FakeService) RemoveTeamMember(ctx context.Context, cmd *team.RemoveTeamMemberCommand) error {
	return s.ExpectedError
}

func (s *FakeService) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*team.TeamMemberDTO, error) {
	return s.ExpectedMembers, s.ExpectedError
}

func (s *FakeService) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	return s.ExpectedMembers, s.ExpectedError
}

func (s *FakeService) IsAdminOfTeams(ctx context.Context, query *team.IsAdminOfTeamsQuery) (bool, error) {
	return s.ExpectedIsAdmin, s.ExpectedError
}

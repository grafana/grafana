package teamimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
	cfg   *setting.Cfg
}

func ProvideService(db db.DB, cfg *setting.Cfg) *Service {
	return &Service{
		store: &sqlStore{db: db, Cfg: cfg, dialect: db.GetDialect()},
		cfg:   cfg,
	}
}

func (s *Service) Create(ctx context.Context, name, email string, orgID int64) (team.Team, error) {
	team := team.Team{
		Name:    name,
		Email:   email,
		OrgID:   orgID,
		Created: time.Now(),
		Updated: time.Now(),
	}

	// team name is unique in the org, Verify that the team name is not already taken
	if isNameTaken, err := s.store.GetByName(ctx, team.OrgID, team.Name, 0); err != nil {
		return team, err
	} else if isNameTaken {
		return team, models.ErrTeamNameTaken
	}

	err := s.store.Insert(ctx, &team)
	return team, err
}

func (s *Service) Update(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	// team name is unique in the org, Verify that the team name is not already taken
	if isNameTaken, err := s.store.GetByName(ctx, cmd.OrgID, cmd.Name, cmd.ID); err != nil {
		return err
	} else if isNameTaken {
		return models.ErrTeamNameTaken
	}

	team := team.Team{
		Name:    cmd.Name,
		Email:   cmd.Email,
		Updated: time.Now(),
		ID:      cmd.ID,
	}
	return s.store.Update(ctx, &team)
}

func (s *Service) Delete(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	return s.store.Delete(ctx, cmd)
}

func (s *Service) List(ctx context.Context, query *team.SearchTeamsQuery) (*team.SearchTeamQueryResult, error) {
	query.AcEnabled = !ac.IsDisabled(s.cfg)
	return s.store.List(ctx, query)
}

func (s *Service) ListByUser(ctx context.Context, query *team.GetTeamsByUserQuery) (*team.GetTeamsByUserQueryResult, error) {
	return s.store.ListByUser(ctx, query)
}

func (s *Service) GetById(ctx context.Context, query *team.GetTeamByIdQuery) error {
	return s.store.GetById(ctx, query)
}

func (s *Service) UpdateTeamMember(ctx context.Context, cmd *models.UpdateTeamMemberCommand) error {
	return s.store.UpdateTeamMember(ctx, cmd)
}

func (s *Service) RemoveTeamMember(ctx context.Context, cmd *models.RemoveTeamMemberCommand) error {
	return s.store.RemoveTeamMember(ctx, cmd)
}

func (s *Service) GetTeamMembers(ctx context.Context, cmd *models.GetTeamMembersQuery) error {
	return s.store.GetTeamMembers(ctx, cmd)
}

func (s *Service) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool) ([]*models.TeamMemberDTO, error) {
	return s.store.GetUserTeamMemberships(ctx, orgID, userID, external)
}

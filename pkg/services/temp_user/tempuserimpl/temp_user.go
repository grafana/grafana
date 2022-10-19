package tempuserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
)

type Service struct {
	store store
}

func ProvideService(
	db db.DB,
) tempuser.Service {
	return &Service{
		store: &xormStore{db: db},
	}
}

func (s *Service) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	err := s.store.UpdateTempUserStatus(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	err := s.store.CreateTempUser(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	err := s.store.UpdateTempUserWithEmailSent(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetTempUsersQuery(ctx context.Context, cmd *models.GetTempUsersQuery) error {
	err := s.store.GetTempUsersQuery(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetTempUserByCode(ctx context.Context, cmd *models.GetTempUserByCodeQuery) error {
	err := s.store.GetTempUserByCode(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	err := s.store.ExpireOldUserInvites(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

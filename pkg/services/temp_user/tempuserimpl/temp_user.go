package tempuserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
)

type Service struct {
	store store
}

func ProvideService(db db.DB) tempuser.Service {
	return &Service{
		store: &xormStore{db: db},
	}
}

func (s *Service) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	return s.store.UpdateTempUserStatus(ctx, cmd)
}

func (s *Service) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	return s.store.CreateTempUser(ctx, cmd)
}

func (s *Service) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	return s.store.UpdateTempUserWithEmailSent(ctx, cmd)
}

func (s *Service) GetTempUsersQuery(ctx context.Context, cmd *models.GetTempUsersQuery) error {
	return s.store.GetTempUsersQuery(ctx, cmd)
}

func (s *Service) GetTempUserByCode(ctx context.Context, cmd *models.GetTempUserByCodeQuery) error {
	return s.store.GetTempUserByCode(ctx, cmd)
}

func (s *Service) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	return s.store.ExpireOldUserInvites(ctx, cmd)
}

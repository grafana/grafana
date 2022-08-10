package tempuserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
)

type Service struct {
	// TODO remove sqlstore
	sqlStore *sqlstore.SQLStore
}

func ProvideService(
	ss *sqlstore.SQLStore,
) tempuser.Service {
	return &Service{
		sqlStore: ss,
	}
}

func (s *Service) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	err := s.sqlStore.UpdateTempUserStatus(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	err := s.sqlStore.CreateTempUser(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.UpdateTempUserWithEmailSentCommand) error {
	err := s.sqlStore.UpdateTempUserWithEmailSent(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetTempUsersQuery(ctx context.Context, cmd *models.GetTempUsersQuery) error {
	err := s.sqlStore.GetTempUsersQuery(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetTempUserByCode(ctx context.Context, cmd *models.GetTempUserByCodeQuery) error {
	err := s.sqlStore.GetTempUserByCode(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) ExpireOldUserInvites(ctx context.Context, cmd *models.ExpireTempUsersCommand) error {
	err := s.sqlStore.ExpireOldUserInvites(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

package tempuserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(
	db db.DB,
	settingsProvider setting.SettingsProvider,
) tempuser.Service {
	return &Service{
		store: &xormStore{db: db, settingsProvider: settingsProvider},
	}
}

func (s *Service) UpdateTempUserStatus(ctx context.Context, cmd *tempuser.UpdateTempUserStatusCommand) error {
	err := s.store.UpdateTempUserStatus(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) CreateTempUser(ctx context.Context, cmd *tempuser.CreateTempUserCommand) (*tempuser.TempUser, error) {
	res, err := s.store.CreateTempUser(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) UpdateTempUserWithEmailSent(ctx context.Context, cmd *tempuser.UpdateTempUserWithEmailSentCommand) error {
	err := s.store.UpdateTempUserWithEmailSent(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetTempUsersQuery(ctx context.Context, cmd *tempuser.GetTempUsersQuery) ([]*tempuser.TempUserDTO, error) {
	res, err := s.store.GetTempUsersQuery(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) GetTempUserByCode(ctx context.Context, cmd *tempuser.GetTempUserByCodeQuery) (*tempuser.TempUserDTO, error) {
	res, err := s.store.GetTempUserByCode(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (s *Service) ExpireOldUserInvites(ctx context.Context, cmd *tempuser.ExpireTempUsersCommand) error {
	err := s.store.ExpireOldUserInvites(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) ExpireOldVerifications(ctx context.Context, cmd *tempuser.ExpireTempUsersCommand) error {
	err := s.store.ExpireOldVerifications(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) ExpirePreviousVerifications(ctx context.Context, cmd *tempuser.ExpirePreviousVerificationsCommand) error {
	err := s.store.ExpirePreviousVerifications(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

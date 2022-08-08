package tempuserimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/user"
)

type Service struct {
	// TODO remove sqlstore
	sqlStore *sqlstore.SQLStore
}

func ProvideService(
	db db.DB,
	ss *sqlstore.SQLStore,
) user.Service {
	return &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
		sqlStore: ss,
	}
}

func (ss *SQLStore) UpdateTempUserStatus(ctx context.Context, cmd *models.UpdateTempUserStatusCommand) error {
	err := s.sqlStore.UpdateTempUserStatus(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

func (ss *SQLStore) CreateTempUser(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	err := s.sqlStore.CreateTempUser(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

func (ss *SQLStore) UpdateTempUserWithEmailSent(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	err := s.sqlStore.UpdateTempUserWithEmailSent(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

func (ss *SQLStore) GetTempUsersQuery(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	err := s.sqlStore.GetTempUsersQuery(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

func (ss *SQLStore) ExpireOldUserInvites(ctx context.Context, cmd *models.CreateTempUserCommand) error {
	err := s.sqlStore.ExpireOldUserInvites(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ServiceAccountsStoreImpl struct {
	sqlStore *sqlstore.SQLStore
}

func NewServiceAccountsStore(store *sqlstore.SQLStore) *ServiceAccountsStoreImpl {
	return &ServiceAccountsStoreImpl{
		sqlStore: store,
	}
}

func (s *ServiceAccountsStoreImpl) DeleteServiceAccount(ctx context.Context, serviceaccountID int64) error {
	cmd := &models.DeleteServiceAccountCommand{ServiceAccountID: serviceaccountID}
	err := sqlstore.DeleteServiceAccount(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

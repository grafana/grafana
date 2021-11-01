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

func (s *ServiceAccountsStoreImpl) DeleteServiceAccount(ctx context.Context, orgID, serviceaccountID int64) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return deleteServiceAccountInTransaction(sess, orgID, serviceaccountID)
	})
}

func deleteServiceAccountInTransaction(sess *sqlstore.DBSession, orgID, serviceAccountID int64) error {
	user := models.User{
		OrgId:            orgID,
		Id:               serviceAccountID,
		IsServiceAccount: true,
	}
	has, err := sess.Get(&user)
	if err != nil {
		return err
	}
	if !has {
		return models.ErrUserNotFound
	}
	for _, sql := range sqlstore.ServiceAccountDeletions() {
		_, err := sess.Exec(sql, user.Id)
		if err != nil {
			return err
		}
	}
	return nil
}

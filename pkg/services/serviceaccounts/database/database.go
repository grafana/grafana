package database

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/infra/log"
)

type ServiceAccountsStoreImpl struct {
	sqlStore *sqlstore.SQLStore
	log      log.Logger
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
	user := models.User{}
	has, err := sess.Where(`org_id = ? and id = ? and is_service_account = true`, orgID, serviceAccountID).Get(&user)
	if err != nil {
		return err
	}
	if !has {
		return serviceaccounts.ErrServiceAccountNotFound
	}
	for _, sql := range sqlstore.ServiceAccountDeletions() {
		_, err := sess.Exec(sql, user.Id)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *ServiceAccountsStoreImpl) UpgradeServiceAccounts(ctx context.Context) error {
	basicKeys := s.sqlStore.GetNonServiceAccountAPIKeys(ctx)
	if len(basicKeys) > 0 {
		s.log.Info("Launching background thread to upgrade API keys to service accounts", "numberKeys", len(basicKeys))
		go func() {
			for _, key := range basicKeys {
				sa, err := s.sqlStore.CreateServiceAccountForApikey(ctx, key.OrgId, key.Name, key.Role)
				if err != nil {
					s.log.Error("Failed to create service account for API key", "err", err, "keyId", key.Id)
					continue
				}

				err = s.sqlStore.UpdateApikeyServiceAccount(ctx, key.Id, sa.Id)
				if err != nil {
					s.log.Error("Failed to attach new service account to API key", "err", err, "keyId", key.Id, "newServiceAccountId", sa.Id)
					continue
				}
				s.log.Debug("Updated basic api key", "keyId", key.Id, "newServiceAccountId", sa.Id)
			}
		}()
	}
	return nil
}

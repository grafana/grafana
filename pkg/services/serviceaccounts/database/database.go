package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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

func (s *ServiceAccountsStoreImpl) CreateServiceAccount(ctx context.Context, sa *serviceaccounts.CreateServiceaccountForm) (user *models.User, err error) {
	// create a new service account - "user" with empty permissions
	cmd := models.CreateUserCommand{
		Login:            "Service-Account-" + uuid.New().String(),
		Name:             sa.Name + "-Service-Account-" + uuid.New().String(),
		OrgId:            sa.OrgID,
		IsServiceAccount: true,
	}
	newuser, err := s.sqlStore.CreateUser(ctx, cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %v", err)
	}
	return newuser, nil
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

func (s *ServiceAccountsStoreImpl) ListServiceAccounts(ctx context.Context, orgID int64) ([]*models.OrgUserDTO, error) {
	query := models.GetOrgUsersQuery{OrgId: orgID, IsServiceAccount: true}
	err := s.sqlStore.GetOrgUsers(ctx, &query)
	if err != nil {
		return nil, err
	}
	return query.Result, err
}

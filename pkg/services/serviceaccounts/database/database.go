package database

import (
	"context"
	"errors"
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

func (s *ServiceAccountsStoreImpl) HasMigrated(ctx context.Context, orgID int64) (bool, error) {
	// performace: might want to check how to implement a cache here
	err := s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Try and find the user by login first.
		// It's not sufficient to assume that a LoginOrEmail with an "@" is an email.
		org := &models.Org{Id: orgID}
		has, err := sess.Get(org)
		if err != nil {
			return err
		}
		if !has {
			return errors.New("org not found")
		}
		rawSQL := "SELECT count(*) FROM migration_log WHERE migration_id = ?"
		/* queryWithWildcards := "service accounts org:" + fmt.Sprint(orgID) */
		queryWithWildcards := "Update user table charset"
		results, err := sess.SQL(rawSQL, queryWithWildcards).Count()
		if err != nil {
			return err
		}
		if results != 1 {
			return errors.New("invalid result set")
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return true, nil
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
			// TODO: create migration_log in the migration_log table
		}()
	}
	return nil
}

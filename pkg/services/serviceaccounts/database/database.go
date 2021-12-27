package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	ServiceAccountsMigrationIdPrefix = "service accounts migration"
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
		org := &models.Org{Id: orgID}
		has, err := sess.Get(org)
		if err != nil {
			return err
		}
		if !has {
			return errors.New("org not found")
		}
		rawSQL := fmt.Sprintf("SELECT count(*) FROM migration_log WHERE migration_id = %s", getMigrationId(orgID))
		results, err := sess.SQL(rawSQL).Count()
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

// TODO: write test
/*
write benchmarks if possible
*/
func (s *ServiceAccountsStoreImpl) UpgradeServiceAccounts(ctx context.Context) error {
	canStart, err := s.startMigration(ctx, orgID)
	if err != nil {
		return err
	}
	if !canStart {
		// inprogress
		return nil
	}
	basicKeys := s.sqlStore.GetNonServiceAccountAPIKeys(ctx)
	if len(basicKeys) > 0 {
		s.log.Info("Launching background thread to upgrade API keys to service accounts", "numberKeys", len(basicKeys))
		go func() {
			// TODO: make everything here into function - to be testable and readable
			migrationCtx, cancel := context.WithTimeout(context.Background(), time.Hour*1)
			defer cancel()
			err := s.sqlStore.WithTransactionalDbSession(migrationCtx, func(sess *sqlstore.DBSession) error {
				for _, key := range basicKeys {
					// TODO: pass in sess and move these into the package
					sa, err := s.sqlStore.CreateServiceAccountForApikey(migrationCtx, sess, key.OrgId, key.Name, key.Role)
					if err != nil {
						return err
					}
					// TODO: pass in sess and move these into the package
					err = s.sqlStore.UpdateApikeyServiceAccount(migrationCtx, sess, key.Id, sa.Id)
					if err != nil {
						return err
					}
					s.log.Debug("Updated basic api key", "keyId", key.Id, "newServiceAccountId", sa.Id)
				}
				// adding to migration log so that we do not do this again
				err := s.updateMigrationLog(migrationCtx, orgID, true, nil)
				if err != nil {
					s.log.Error("Failed to update migration log", "err", err)
				}
				return nil
			})

			if err != nil {
				err := s.updateMigrationLog(migrationCtx, orgID, false, err)
				s.log.Error("Failed to update migration log", "err", err)
			}
		}()
	} else {
		// no basic apikeys found
		return s.updateMigrationLog(ctx, orgID, true, nil)
	}
	return nil
}

// TODO: write tests
// TODO: rename potentially
func (s *ServiceAccountsStoreImpl) startMigration(ctx context.Context, orgID int64) (bool, error) {
	canStart := false
	// 1. get migration log
	err := s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		migrationIdString := getMigrationId(orgID)
		migration := migrator.MigrationLog{MigrationID: migrationIdString}
		exists, _ := sess.Get(&migration)
		// 2. if not found, create, state: progress
		if !exists {
			m := migrator.MigrationLog{
				MigrationID: migrationIdString,
				Timestamp:   time.Now(),
				SQL:         "service account code migration",
			}
			if _, err := sess.Insert(&m); err != nil {
				return err
			}
			// created the migration log
			canStart = true
			return nil
		}
		// 3. if found,
		// 3.1 if state is error:
		if !migration.Success && migration.Error != "" {
			// update migration log
			migration.Success = false
			migration.Error = ""
			migration.Timestamp = time.Now()

			if _, err := sess.Update(&migration); err != nil {
				return err
			}
			canStart = true
			return nil
		}
		// 3.2 if state is progress && timestamp + 1h < now, update state to progress else return nil
		if !migration.Success && migration.Timestamp.Add(time.Hour).Before(time.Now()) {
			migration.Success = false
			migration.Error = ""
			migration.Timestamp = time.Now()

			if _, err := sess.Update(&migration); err != nil {
				return err
			}
			canStart = true
			return nil
		}
		// canStart = false, error = nil
		// inProgress
		return nil
	})
	return canStart, err
}

func (s *ServiceAccountsStoreImpl) updateMigrationLog(ctx context.Context, orgID int64, success bool, err error) error {
	migration := migrator.MigrationLog{MigrationID: getMigrationId(orgID)}
	migration.Success = success
	migration.Error = err.Error()
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Update(&migration)
		return err
	})
}

func getMigrationId(orgID int64) string {
	return fmt.Sprintf("%s : %d", ServiceAccountsMigrationIdPrefix, orgID)
}

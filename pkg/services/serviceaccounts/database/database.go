package database

//nolint:goimports
import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"xorm.io/xorm"
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
				err := s.CreateServiceAccountFromApikey(ctx, key)
				if err != nil {
					s.log.Error("migating to service accounts failed with error", err)
				}
			}
		}()
	}
	return nil
}

func (s *ServiceAccountsStoreImpl) ConvertToServiceAccounts(ctx context.Context, keys []int64) error {
	basicKeys := s.sqlStore.GetNonServiceAccountAPIKeys(ctx)
	if len(basicKeys) == 0 {
		return nil
	}
	if len(basicKeys) != len(keys) {
		return fmt.Errorf("one of the keys already has a serviceaccount")
	}
	for _, key := range basicKeys {
		if !contains(keys, key.Id) {
			s.log.Error("convert service accounts stopped for keyId %d as it is not part of the query to convert or already has a service account", key.Id)
			continue
		}
		err := s.CreateServiceAccountFromApikey(ctx, key)
		if err != nil {
			s.log.Error("converting to service accounts failed with error", err)
		}
	}
	return nil
}

func (s *ServiceAccountsStoreImpl) CreateServiceAccountFromApikey(ctx context.Context, key *models.ApiKey) error {
	sa, err := s.sqlStore.CreateServiceAccountForApikey(ctx, key.OrgId, key.Name, key.Role)
	if err != nil {
		return fmt.Errorf("failed to create service account for API key with error : %w", err)
	}

	err = s.sqlStore.UpdateApikeyServiceAccount(ctx, key.Id, sa.Id)
	if err != nil {
		return fmt.Errorf("failed to attach new service account to API key for keyId: %d and newServiceAccountId: %d with error: %w", key.Id, sa.Id, err)
	}
	s.log.Debug("Updated basic api key", "keyId", key.Id, "newServiceAccountId", sa.Id)
	return nil
}

//nolint:gosimple
func (s *ServiceAccountsStoreImpl) ListTokens(ctx context.Context, orgID int64, serviceAccountID int64) ([]*models.ApiKey, error) {
	result := make([]*models.ApiKey, 0)
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var sess *xorm.Session

		sess = dbSession.Limit(100, 0).
			Join("inner", "user", "user.id = api_key.service_account_id").
			Where("user.org_id=? AND user.id=? AND ( expires IS NULL or expires >= ?)", orgID, serviceAccountID, time.Now().Unix()).
			Asc("name")

		return sess.Find(&result)
	})
	return result, err
}

func (s *ServiceAccountsStoreImpl) ListServiceAccounts(ctx context.Context, orgID, serviceAccountID int64) ([]*models.OrgUserDTO, error) {
	query := models.GetOrgUsersQuery{OrgId: orgID, IsServiceAccount: true}
	if serviceAccountID > 0 {
		query.UserID = serviceAccountID
	}

	err := s.sqlStore.GetOrgUsers(ctx, &query)
	if err != nil {
		return nil, err
	}

	return query.Result, err
}

// RetrieveServiceAccountByID returns a service account by its ID
func (s *ServiceAccountsStoreImpl) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*models.OrgUserDTO, error) {
	query := models.GetOrgUsersQuery{UserID: serviceAccountID, OrgId: orgID, IsServiceAccount: true}
	err := s.sqlStore.GetOrgUsers(ctx, &query)
	if err != nil {
		return nil, err
	}

	if len(query.Result) != 1 {
		return nil, serviceaccounts.ErrServiceAccountNotFound
	}

	return query.Result[0], err
}

func contains(s []int64, e int64) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

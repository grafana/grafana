package database

//nolint:goimports
import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

type ServiceAccountsStoreImpl struct {
	sqlStore      *sqlstore.SQLStore
	apiKeyService apikey.Service
	kvStore       kvstore.KVStore
	log           log.Logger
	userService   user.Service
}

func ProvideServiceAccountsStore(store *sqlstore.SQLStore, apiKeyService apikey.Service, kvStore kvstore.KVStore) *ServiceAccountsStoreImpl {
	return &ServiceAccountsStoreImpl{
		sqlStore:      store,
		apiKeyService: apiKeyService,
		kvStore:       kvStore,
		log:           log.New("serviceaccounts.store"),
	}
}

// CreateServiceAccount creates service account
func (s *ServiceAccountsStoreImpl) CreateServiceAccount(ctx context.Context, orgId int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	generatedLogin := "sa-" + strings.ToLower(saForm.Name)
	generatedLogin = strings.ReplaceAll(generatedLogin, " ", "-")
	isDisabled := false
	role := org.RoleViewer
	if saForm.IsDisabled != nil {
		isDisabled = *saForm.IsDisabled
	}
	if saForm.Role != nil {
		role = *saForm.Role
	}
	var newSA *user.User
	createErr := s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) (err error) {
		var errUser error
		newSA, errUser = s.sqlStore.CreateUser(ctx, user.CreateUserCommand{
			Login:            generatedLogin,
			OrgID:            orgId,
			Name:             saForm.Name,
			IsDisabled:       isDisabled,
			IsServiceAccount: true,
			SkipOrgSetup:     true,
		})
		if errUser != nil {
			return errUser
		}

		errAddOrgUser := s.sqlStore.AddOrgUser(ctx, &models.AddOrgUserCommand{
			Role:                      role,
			OrgId:                     orgId,
			UserId:                    newSA.ID,
			AllowAddingServiceAccount: true,
		})
		if errAddOrgUser != nil {
			return errAddOrgUser
		}

		return nil
	})

	if createErr != nil {
		if errors.Is(createErr, user.ErrUserAlreadyExists) {
			return nil, ErrServiceAccountAlreadyExists
		}

		return nil, fmt.Errorf("failed to create service account: %w", createErr)
	}

	return &serviceaccounts.ServiceAccountDTO{
		Id:         newSA.ID,
		Name:       newSA.Name,
		Login:      newSA.Login,
		OrgId:      newSA.OrgID,
		Tokens:     0,
		Role:       string(role),
		IsDisabled: isDisabled,
	}, nil
}

// UpdateServiceAccount updates service account
func (s *ServiceAccountsStoreImpl) UpdateServiceAccount(ctx context.Context,
	orgId, serviceAccountId int64,
	saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	updatedUser := &serviceaccounts.ServiceAccountProfileDTO{}

	err := s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		updatedUser, err = s.RetrieveServiceAccount(ctx, orgId, serviceAccountId)
		if err != nil {
			return err
		}

		if saForm.Name == nil && saForm.Role == nil && saForm.IsDisabled == nil {
			return nil
		}

		updateTime := time.Now()
		if saForm.Role != nil {
			var orgUser models.OrgUser
			orgUser.Role = *saForm.Role
			orgUser.Updated = updateTime

			if _, err := sess.Where("org_id = ? AND user_id = ?", orgId, serviceAccountId).Update(&orgUser); err != nil {
				return err
			}

			updatedUser.Role = string(*saForm.Role)
		}

		if saForm.Name != nil || saForm.IsDisabled != nil {
			user := user.User{
				Updated: updateTime,
			}

			if saForm.IsDisabled != nil {
				user.IsDisabled = *saForm.IsDisabled
				updatedUser.IsDisabled = *saForm.IsDisabled
				sess.UseBool("is_disabled")
			}

			if saForm.Name != nil {
				user.Name = *saForm.Name
				updatedUser.Name = *saForm.Name
			}

			if _, err := sess.ID(serviceAccountId).Update(&user); err != nil {
				return err
			}
		}

		return nil
	})

	return updatedUser, err
}

func ServiceAccountDeletions() []string {
	deletes := []string{
		"DELETE FROM api_key WHERE service_account_id = ?",
	}
	deletes = append(deletes, sqlstore.UserDeletions()...)
	return deletes
}

// DeleteServiceAccount deletes service account and all associated tokens
func (s *ServiceAccountsStoreImpl) DeleteServiceAccount(ctx context.Context, orgId, serviceAccountId int64) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return s.deleteServiceAccount(sess, orgId, serviceAccountId)
	})
}

func (s *ServiceAccountsStoreImpl) deleteServiceAccount(sess *sqlstore.DBSession, orgId, serviceAccountId int64) error {
	user := user.User{}
	has, err := sess.Where(`org_id = ? and id = ? and is_service_account = ?`,
		orgId, serviceAccountId, s.sqlStore.Dialect.BooleanStr(true)).Get(&user)
	if err != nil {
		return err
	}
	if !has {
		return serviceaccounts.ErrServiceAccountNotFound
	}
	for _, sql := range ServiceAccountDeletions() {
		_, err := sess.Exec(sql, user.ID)
		if err != nil {
			return err
		}
	}
	return nil
}

// RetrieveServiceAccount returns a service account by its ID
func (s *ServiceAccountsStoreImpl) RetrieveServiceAccount(ctx context.Context, orgId, serviceAccountId int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	serviceAccount := &serviceaccounts.ServiceAccountProfileDTO{}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.Dialect.Quote("user"),
			fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.Dialect.Quote("user")))

		whereConditions := make([]string, 0, 3)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, orgId)

		whereConditions = append(whereConditions, "org_user.user_id = ?")
		whereParams = append(whereParams, serviceAccountId)

		whereConditions = append(whereConditions,
			fmt.Sprintf("%s.is_service_account = %s",
				s.sqlStore.Dialect.Quote("user"),
				s.sqlStore.Dialect.BooleanStr(true)))

		sess.Where(strings.Join(whereConditions, " AND "), whereParams...)

		sess.Cols(
			"org_user.user_id",
			"org_user.org_id",
			"org_user.role",
			"user.email",
			"user.name",
			"user.login",
			"user.created",
			"user.updated",
			"user.is_disabled",
		)

		if ok, err := sess.Get(serviceAccount); err != nil {
			return err
		} else if !ok {
			return serviceaccounts.ErrServiceAccountNotFound
		}

		return nil
	})

	return serviceAccount, err
}

func (s *ServiceAccountsStoreImpl) RetrieveServiceAccountIdByName(ctx context.Context, orgId int64, name string) (int64, error) {
	serviceAccount := &struct {
		Id int64
	}{}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sess := dbSession.Table("user")

		whereConditions := []string{
			fmt.Sprintf("%s.name = ?",
				s.sqlStore.Dialect.Quote("user")),
			fmt.Sprintf("%s.org_id = ?",
				s.sqlStore.Dialect.Quote("user")),
			fmt.Sprintf("%s.is_service_account = %s",
				s.sqlStore.Dialect.Quote("user"),
				s.sqlStore.Dialect.BooleanStr(true)),
		}
		whereParams := []interface{}{name, orgId}

		sess.Where(strings.Join(whereConditions, " AND "), whereParams...)

		sess.Cols(
			"user.id",
		)

		if ok, err := sess.Get(serviceAccount); err != nil {
			return err
		} else if !ok {
			return serviceaccounts.ErrServiceAccountNotFound
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	return serviceAccount.Id, nil
}

func (s *ServiceAccountsStoreImpl) SearchOrgServiceAccounts(
	ctx context.Context, orgId int64, query string, filter serviceaccounts.ServiceAccountFilter, page int, limit int,
	signedInUser *user.SignedInUser,
) (*serviceaccounts.SearchServiceAccountsResult, error) {
	searchResult := &serviceaccounts.SearchServiceAccountsResult{
		TotalCount:      0,
		ServiceAccounts: make([]*serviceaccounts.ServiceAccountDTO, 0),
		Page:            page,
		PerPage:         limit,
	}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.Dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.Dialect.Quote("user")))

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, orgId)

		whereConditions = append(whereConditions,
			fmt.Sprintf("%s.is_service_account = %s",
				s.sqlStore.Dialect.Quote("user"),
				s.sqlStore.Dialect.BooleanStr(true)))

		if !accesscontrol.IsDisabled(s.sqlStore.Cfg) {
			acFilter, err := accesscontrol.Filter(signedInUser, "org_user.user_id", "serviceaccounts:id:", serviceaccounts.ActionRead)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query != "" {
			queryWithWildcards := "%" + query + "%"
			whereConditions = append(whereConditions, "(email "+s.sqlStore.Dialect.LikeStr()+" ? OR name "+s.sqlStore.Dialect.LikeStr()+" ? OR login "+s.sqlStore.Dialect.LikeStr()+" ?)")
			whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
		}

		switch filter {
		case serviceaccounts.FilterIncludeAll:
			// pass
		case serviceaccounts.FilterOnlyExpiredTokens:
			now := time.Now().Unix()
			// we do a subquery to remove duplicates coming from joining in api_keys, if we find more than one api key that has expired
			whereConditions = append(
				whereConditions,
				"(SELECT count(*) FROM api_key WHERE api_key.service_account_id = org_user.user_id AND api_key.expires < ?) > 0")
			whereParams = append(whereParams, now)
		case serviceaccounts.FilterOnlyDisabled:
			whereConditions = append(
				whereConditions,
				"is_disabled = ?")
			whereParams = append(whereParams, s.sqlStore.Dialect.BooleanStr(true))
		default:
			s.log.Warn("invalid filter user for service account filtering", "service account search filtering", filter)
		}

		if len(whereConditions) > 0 {
			sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}
		if limit > 0 {
			offset := limit * (page - 1)
			sess.Limit(limit, offset)
		}

		sess.Cols(
			"org_user.user_id",
			"org_user.org_id",
			"org_user.role",
			"user.email",
			"user.name",
			"user.login",
			"user.last_seen_at",
			"user.is_disabled",
		)
		sess.Asc("user.email", "user.login")
		if err := sess.Find(&searchResult.ServiceAccounts); err != nil {
			return err
		}

		// get total
		serviceaccount := serviceaccounts.ServiceAccountDTO{}
		countSess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.Dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.Dialect.Quote("user")))

		if len(whereConditions) > 0 {
			countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}
		count, err := countSess.Count(&serviceaccount)
		if err != nil {
			return err
		}
		searchResult.TotalCount = count

		return nil
	})
	if err != nil {
		return nil, err
	}

	return searchResult, nil
}

func (s *ServiceAccountsStoreImpl) GetAPIKeysMigrationStatus(ctx context.Context, orgId int64) (status *serviceaccounts.APIKeysMigrationStatus, err error) {
	migrationStatus, exists, err := s.kvStore.Get(ctx, orgId, "serviceaccounts", "migrationStatus")
	if err != nil {
		return nil, err
	}
	if exists && migrationStatus == "1" {
		return &serviceaccounts.APIKeysMigrationStatus{
			Migrated: true,
		}, nil
	} else {
		return &serviceaccounts.APIKeysMigrationStatus{
			Migrated: false,
		}, nil
	}
}

func (s *ServiceAccountsStoreImpl) HideApiKeysTab(ctx context.Context, orgId int64) error {
	if err := s.kvStore.Set(ctx, orgId, "serviceaccounts", "hideApiKeys", "1"); err != nil {
		s.log.Error("Failed to hide API keys tab", err)
	}
	return nil
}

func (s *ServiceAccountsStoreImpl) MigrateApiKeysToServiceAccounts(ctx context.Context, orgId int64) error {
	basicKeys, err := s.apiKeyService.GetAllAPIKeys(ctx, orgId)
	if err != nil {
		return err
	}
	if len(basicKeys) > 0 {
		for _, key := range basicKeys {
			err := s.CreateServiceAccountFromApikey(ctx, key)
			if err != nil {
				s.log.Error("migating to service accounts failed with error", err)
				return err
			}
			s.log.Debug("API key converted to service account token", "keyId", key.Id)
		}
	}
	if err := s.kvStore.Set(ctx, orgId, "serviceaccounts", "migrationStatus", "1"); err != nil {
		s.log.Error("Failed to write API keys migration status", err)
	}
	return nil
}

func (s *ServiceAccountsStoreImpl) MigrateApiKey(ctx context.Context, orgId int64, keyId int64) error {
	basicKeys, err := s.apiKeyService.GetAllAPIKeys(ctx, orgId)
	if err != nil {
		return err
	}
	if len(basicKeys) == 0 {
		return fmt.Errorf("no API keys to convert found")
	}
	for _, key := range basicKeys {
		if keyId == key.Id {
			err := s.CreateServiceAccountFromApikey(ctx, key)
			if err != nil {
				s.log.Error("converting to service account failed with error", "keyId", keyId, "error", err)
				return err
			}
		}
	}
	return nil
}

func (s *ServiceAccountsStoreImpl) CreateServiceAccountFromApikey(ctx context.Context, key *apikey.APIKey) error {
	prefix := "sa-autogen"
	cmd := user.CreateUserCommand{
		Login:            fmt.Sprintf("%v-%v-%v", prefix, key.OrgId, key.Name),
		Name:             fmt.Sprintf("%v-%v", prefix, key.Name),
		OrgID:            key.OrgId,
		DefaultOrgRole:   string(key.Role),
		IsServiceAccount: true,
	}

	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		newSA, errCreateSA := s.sqlStore.CreateUser(ctx, cmd)
		if errCreateSA != nil {
			return fmt.Errorf("failed to create service account: %w", errCreateSA)
		}

		if err := s.assignApiKeyToServiceAccount(sess, key.Id, newSA.ID); err != nil {
			if err := s.userService.Delete(ctx, &user.DeleteUserCommand{UserID: newSA.ID}); err != nil {
				s.log.Error("Error deleting service account", "error", err)
			}
			return fmt.Errorf("failed to migrate API key to service account token: %w", err)
		}

		return nil
	})
}

// RevertApiKey converts service account token to old API key
func (s *ServiceAccountsStoreImpl) RevertApiKey(ctx context.Context, saId int64, keyId int64) error {
	query := apikey.GetByIDQuery{ApiKeyId: keyId}
	if err := s.apiKeyService.GetApiKeyById(ctx, &query); err != nil {
		return err
	}
	key := query.Result

	if key.ServiceAccountId == nil {
		return fmt.Errorf("API key is not service account token")
	}

	if *key.ServiceAccountId != saId {
		return ErrServiceAccountAndTokenMismatch
	}

	tokens, err := s.ListTokens(ctx, &serviceaccounts.GetSATokensQuery{
		OrgID:            &key.OrgId,
		ServiceAccountID: key.ServiceAccountId,
	})
	if err != nil {
		return fmt.Errorf("cannot revert token: %w", err)
	}
	if len(tokens) > 1 {
		return fmt.Errorf("cannot revert token: service account contains more than one token")
	}

	err = s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		user := user.User{}
		has, err := sess.Where(`org_id = ? and id = ? and is_service_account = ?`,
			key.OrgId, *key.ServiceAccountId, s.sqlStore.Dialect.BooleanStr(true)).Get(&user)
		if err != nil {
			return err
		}
		if !has {
			return serviceaccounts.ErrServiceAccountNotFound
		}
		// Detach API key from service account
		if err := s.detachApiKeyFromServiceAccount(sess, key.Id); err != nil {
			return err
		}
		// Delete service account
		if err := s.deleteServiceAccount(sess, key.OrgId, *key.ServiceAccountId); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("cannot revert token to API key: %w", err)
	}
	return nil
}

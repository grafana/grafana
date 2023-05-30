package database

//nolint:goimports
import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type ServiceAccountsStoreImpl struct {
	cfg           *setting.Cfg
	sqlStore      db.DB
	apiKeyService apikey.Service
	kvStore       kvstore.KVStore
	log           log.Logger
	orgService    org.Service
	userService   user.Service
}

func ProvideServiceAccountsStore(cfg *setting.Cfg, store db.DB, apiKeyService apikey.Service,
	kvStore kvstore.KVStore, userService user.Service, orgService org.Service) *ServiceAccountsStoreImpl {
	return &ServiceAccountsStoreImpl{
		cfg:           cfg,
		sqlStore:      store,
		apiKeyService: apiKeyService,
		kvStore:       kvStore,
		log:           log.New("serviceaccounts.store"),
		orgService:    orgService,
		userService:   userService,
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

	newSA, err := s.userService.CreateServiceAccount(ctx, &user.CreateUserCommand{
		Login:            generatedLogin,
		OrgID:            orgId,
		Name:             saForm.Name,
		IsDisabled:       isDisabled,
		IsServiceAccount: true,
		DefaultOrgRole:   string(role),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create service account: %w", err)
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
func (s *ServiceAccountsStoreImpl) UpdateServiceAccount(
	ctx context.Context,
	orgId, serviceAccountId int64,
	saForm *serviceaccounts.UpdateServiceAccountForm,
) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	updatedUser := &serviceaccounts.ServiceAccountProfileDTO{}

	err := s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
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
			var orgUser org.OrgUser
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

func ServiceAccountDeletions(dialect migrator.Dialect) []string {
	deletes := []string{
		"DELETE FROM api_key WHERE service_account_id = ?",
	}
	deletes = append(deletes, serviceAccountDeletions(dialect)...)
	return deletes
}

// DeleteServiceAccount deletes service account and all associated tokens
func (s *ServiceAccountsStoreImpl) DeleteServiceAccount(ctx context.Context, orgId, serviceAccountId int64) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return s.deleteServiceAccount(sess, orgId, serviceAccountId)
	})
}

func (s *ServiceAccountsStoreImpl) deleteServiceAccount(sess *db.Session, orgId, serviceAccountId int64) error {
	user := user.User{}
	has, err := sess.Where(`org_id = ? and id = ? and is_service_account = ?`,
		orgId, serviceAccountId, s.sqlStore.GetDialect().BooleanStr(true)).Get(&user)
	if err != nil {
		return err
	}
	if !has {
		return serviceaccounts.ErrServiceAccountNotFound.Errorf("service account with id %d not found", serviceAccountId)
	}
	for _, sql := range ServiceAccountDeletions(s.sqlStore.GetDialect()) {
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

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.GetDialect().Quote("user"),
			fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.GetDialect().Quote("user")))

		whereConditions := make([]string, 0, 3)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, orgId)

		whereConditions = append(whereConditions, "org_user.user_id = ?")
		whereParams = append(whereParams, serviceAccountId)

		whereConditions = append(whereConditions,
			fmt.Sprintf("%s.is_service_account = %s",
				s.sqlStore.GetDialect().Quote("user"),
				s.sqlStore.GetDialect().BooleanStr(true)))

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
			return serviceaccounts.ErrServiceAccountNotFound.Errorf("service account with id %d not found", serviceAccountId)
		}

		return nil
	})

	return serviceAccount, err
}

func (s *ServiceAccountsStoreImpl) RetrieveServiceAccountIdByName(ctx context.Context, orgId int64, name string) (int64, error) {
	serviceAccount := &struct {
		Id int64
	}{}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table("user")

		whereConditions := []string{
			fmt.Sprintf("%s.name = ?",
				s.sqlStore.GetDialect().Quote("user")),
			fmt.Sprintf("%s.org_id = ?",
				s.sqlStore.GetDialect().Quote("user")),
			fmt.Sprintf("%s.is_service_account = %s",
				s.sqlStore.GetDialect().Quote("user"),
				s.sqlStore.GetDialect().BooleanStr(true)),
		}
		whereParams := []interface{}{name, orgId}

		sess.Where(strings.Join(whereConditions, " AND "), whereParams...)

		sess.Cols(
			"user.id",
		)

		if ok, err := sess.Get(serviceAccount); err != nil {
			return err
		} else if !ok {
			return serviceaccounts.ErrServiceAccountNotFound.Errorf("service account with name %s not found", name)
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	return serviceAccount.Id, nil
}

func (s *ServiceAccountsStoreImpl) SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error) {
	searchResult := &serviceaccounts.SearchOrgServiceAccountsResult{
		TotalCount:      0,
		ServiceAccounts: make([]*serviceaccounts.ServiceAccountDTO, 0),
		Page:            query.Page,
		PerPage:         query.Limit,
	}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.GetDialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.GetDialect().Quote("user")))

		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		whereConditions = append(whereConditions,
			fmt.Sprintf("%s.is_service_account = %s",
				s.sqlStore.GetDialect().Quote("user"),
				s.sqlStore.GetDialect().BooleanStr(true)))

		if !accesscontrol.IsDisabled(s.cfg) {
			acFilter, err := accesscontrol.Filter(query.SignedInUser, "org_user.user_id", "serviceaccounts:id:", serviceaccounts.ActionRead)
			if err != nil {
				return err
			}
			whereConditions = append(whereConditions, acFilter.Where)
			whereParams = append(whereParams, acFilter.Args...)
		}

		if query.Query != "" {
			queryWithWildcards := "%" + query.Query + "%"
			whereConditions = append(whereConditions, "(email "+s.sqlStore.GetDialect().LikeStr()+" ? OR name "+s.sqlStore.GetDialect().LikeStr()+" ? OR login "+s.sqlStore.GetDialect().LikeStr()+" ?)")
			whereParams = append(whereParams, queryWithWildcards, queryWithWildcards, queryWithWildcards)
		}

		switch query.Filter {
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
			whereParams = append(whereParams, s.sqlStore.GetDialect().BooleanStr(true))
		default:
			s.log.Warn("invalid filter user for service account filtering", "service account search filtering", query.Filter)
		}

		if len(whereConditions) > 0 {
			sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}
		if query.Limit > 0 {
			offset := query.Limit * (query.Page - 1)
			sess.Limit(query.Limit, offset)
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
		sess.Join("INNER", s.sqlStore.GetDialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.GetDialect().Quote("user")))

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
			s.log.Debug("API key converted to service account token", "keyId", key.ID)
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
		if keyId == key.ID {
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
		Login:            fmt.Sprintf("%v-%v-%v", prefix, key.OrgID, key.Name),
		Name:             fmt.Sprintf("%v-%v", prefix, key.Name),
		OrgID:            key.OrgID,
		DefaultOrgRole:   string(key.Role),
		IsServiceAccount: true,
	}

	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		newSA, errCreateSA := s.userService.CreateServiceAccount(ctx, &cmd)
		if errCreateSA != nil {
			return fmt.Errorf("failed to create service account: %w", errCreateSA)
		}

		if err := s.assignApiKeyToServiceAccount(sess, key.ID, newSA.ID); err != nil {
			return fmt.Errorf("failed to migrate API key to service account token: %w", err)
		}

		return nil
	})
}

func serviceAccountDeletions(dialect migrator.Dialect) []string {
	deletes := []string{
		"DELETE FROM star WHERE user_id = ?",
		"DELETE FROM " + dialect.Quote("user") + " WHERE id = ?",
		"DELETE FROM org_user WHERE user_id = ?",
		"DELETE FROM dashboard_acl WHERE user_id = ?",
		"DELETE FROM preferences WHERE user_id = ?",
		"DELETE FROM team_member WHERE user_id = ?",
		"DELETE FROM user_auth WHERE user_id = ?",
		"DELETE FROM user_auth_token WHERE user_id = ?",
		"DELETE FROM quota WHERE user_id = ?",
	}
	return deletes
}

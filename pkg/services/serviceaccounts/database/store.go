package database

//nolint:goimports
import (
	"context"
	"errors"
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
	settingsProvider setting.SettingsProvider
	sqlStore         db.DB
	apiKeyService    apikey.Service
	kvStore          kvstore.KVStore
	log              log.Logger
	orgService       org.Service
	userService      user.Service
}

func ProvideServiceAccountsStore(settingsProvider setting.SettingsProvider, store db.DB, apiKeyService apikey.Service,
	kvStore kvstore.KVStore, userService user.Service, orgService org.Service,
) *ServiceAccountsStoreImpl {
	return &ServiceAccountsStoreImpl{
		settingsProvider: settingsProvider,
		sqlStore:         store,
		apiKeyService:    apiKeyService,
		kvStore:          kvStore,
		log:              log.New("serviceaccounts.store"),
		orgService:       orgService,
		userService:      userService,
	}
}

// generateLogin makes a generated string to have a ID for the service account across orgs and it's name
// this causes you to create a service account with the same name in different orgs
// not the same name in the same org
// -- WARNING:
// -- if you change this function you need to change the ExtSvcLoginPrefix as well
// -- to make sure they are not considered as regular service accounts
func generateLogin(prefix string, orgId int64, name string) string {
	generatedLogin := fmt.Sprintf("%v-%v-%v", prefix, orgId, strings.ToLower(name))
	// in case the name has multiple spaces or dashes in the prefix or otherwise, replace them with a single dash
	generatedLogin = strings.Replace(generatedLogin, "--", "-", 1)
	return strings.ReplaceAll(generatedLogin, " ", "-")
}

// CreateServiceAccount creates service account
func (s *ServiceAccountsStoreImpl) CreateServiceAccount(ctx context.Context, orgId int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	login := generateLogin(serviceaccounts.ServiceAccountPrefix, orgId, saForm.Name)
	isDisabled := false
	role := org.RoleViewer
	if saForm.IsDisabled != nil {
		isDisabled = *saForm.IsDisabled
	}
	if saForm.Role != nil {
		role = *saForm.Role
	}

	newSA, err := s.userService.CreateServiceAccount(ctx, &user.CreateUserCommand{
		Login:            login,
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
		UID:        newSA.UID,
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
		updatedUser, err = s.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{OrgID: orgId, ID: serviceAccountId})
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
		orgId, serviceAccountId, s.sqlStore.GetDialect().BooleanValue(true)).Get(&user)
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

// EnableServiceAccount enable/disable service account
func (s *ServiceAccountsStoreImpl) EnableServiceAccount(ctx context.Context, orgID, serviceAccountID int64, enable bool) error {
	return s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		query := "UPDATE " + s.sqlStore.GetDialect().Quote("user") + " SET is_disabled = ? WHERE id = ? AND is_service_account = ?"
		_, err := sess.Exec(query, !enable, serviceAccountID, true)
		return err
	})
}

// RetrieveServiceAccount returns a service account by its ID or UID
func (s *ServiceAccountsStoreImpl) RetrieveServiceAccount(ctx context.Context, query *serviceaccounts.GetServiceAccountQuery) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	if query.ID == 0 && query.UID == "" {
		return nil, errors.New("either ID or UID must be provided")
	}
	if query.OrgID == 0 {
		return nil, errors.New("OrgID must be provided")
	}

	serviceAccount := &serviceaccounts.ServiceAccountProfileDTO{}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.GetDialect().Quote("user"),
			fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.GetDialect().Quote("user")))

		whereConditions := make([]string, 0, 3)
		whereParams := make([]any, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		if query.ID != 0 {
			whereConditions = append(whereConditions, "org_user.user_id = ?")
			whereParams = append(whereParams, query.ID)
		}

		if query.UID != "" {
			whereConditions = append(whereConditions, fmt.Sprintf("%s.uid = ?", s.sqlStore.GetDialect().Quote("user")))
			whereParams = append(whereParams, query.UID)
		}

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
			"user.uid",
			"user.login",
			"user.created",
			"user.updated",
			"user.is_disabled",
		)

		if ok, err := sess.Get(serviceAccount); err != nil {
			return err
		} else if !ok {
			return serviceaccounts.ErrServiceAccountNotFound.Errorf("service account with id %d or uid %s not found", query.ID, query.UID)
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
		whereParams := []any{name, orgId}

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
		whereConditions := make([]string, 0)
		whereParams := make([]any, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, query.OrgID)

		whereConditions = append(whereConditions,
			fmt.Sprintf("%s.is_service_account = %s",
				s.sqlStore.GetDialect().Quote("user"),
				s.sqlStore.GetDialect().BooleanStr(true)))

		acFilter, err := accesscontrol.Filter(query.SignedInUser, "org_user.user_id", "serviceaccounts:id:", serviceaccounts.ActionRead)
		if err != nil {
			return err
		}
		whereConditions = append(whereConditions, acFilter.Where)
		whereParams = append(whereParams, acFilter.Args...)

		if query.Query != "" {
			sql1, param1 := s.sqlStore.GetDialect().LikeOperator("email", true, query.Query, true)
			sql2, param2 := s.sqlStore.GetDialect().LikeOperator("name", true, query.Query, true)
			sql3, param3 := s.sqlStore.GetDialect().LikeOperator("login", true, query.Query, true)
			whereConditions = append(whereConditions, fmt.Sprintf("(%s OR %s OR %s)", sql1, sql2, sql3))
			whereParams = append(whereParams, param1, param2, param3)
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
			whereParams = append(whereParams, s.sqlStore.GetDialect().BooleanValue(true))
		case serviceaccounts.FilterOnlyExternal:
			sql, param := s.sqlStore.GetDialect().LikeOperator("login", false, serviceaccounts.ExtSvcLoginPrefix(query.OrgID), true)
			whereConditions = append(whereConditions, sql)
			whereParams = append(whereParams, param)
		default:
			s.log.Warn("Invalid filter user for service account filtering", "service account search filtering", query.Filter)
		}

		// Count the number of accounts
		serviceaccount := serviceaccounts.ServiceAccountDTO{}
		countSess := dbSession.Table("org_user")
		countSess.Join("INNER", s.sqlStore.GetDialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.GetDialect().Quote("user")))

		if len(whereConditions) > 0 {
			countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}
		count, err := countSess.Count(&serviceaccount)
		if err != nil {
			return err
		}
		searchResult.TotalCount = count

		// Stop here if we only wanted to count the number of accounts
		if query.CountOnly {
			return nil
		}

		// Fetch service accounts
		sess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.GetDialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.GetDialect().Quote("user")))

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
			"user.uid",
			"user.last_seen_at",
			"user.is_disabled",
		)
		sess.Asc("user.email", "user.login")
		if err := sess.Find(&searchResult.ServiceAccounts); err != nil {
			return err
		}

		// stop here if we don't want to count the number of tokens per service account
		if !query.CountTokens {
			return nil
		}

		// Fetch tokens count for each service account
		accountIDs := make([]int64, len(searchResult.ServiceAccounts))
		for i, serviceAccount := range searchResult.ServiceAccounts {
			accountIDs[i] = serviceAccount.Id
		}

		tokensSess := dbSession.Table("api_key").
			Select("service_account_id, COUNT(id) AS token_count").
			Where("org_id = ?", query.OrgID).
			In("service_account_id", accountIDs).
			GroupBy("service_account_id")

		type tokenCount struct {
			AccountId  int64 `xorm:"service_account_id"`
			TokenCount int64 `xorm:"token_count"`
		}

		var tokens []tokenCount
		if err = tokensSess.Find(&tokens); err != nil {
			return err
		}

		tokenMap := make(map[int64]int64)
		for _, token := range tokens {
			tokenMap[token.AccountId] = token.TokenCount
		}

		for i, account := range searchResult.ServiceAccounts {
			searchResult.ServiceAccounts[i].Tokens = tokenMap[account.Id]
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return searchResult, nil
}

func (s *ServiceAccountsStoreImpl) MigrateApiKeysToServiceAccounts(ctx context.Context, orgId int64) (*serviceaccounts.MigrationResult, error) {
	basicKeys, err := s.apiKeyService.GetAllAPIKeys(ctx, orgId)
	if err != nil {
		return nil, err
	}

	migrationResult := &serviceaccounts.MigrationResult{
		Total:           len(basicKeys),
		Migrated:        0,
		Failed:          0,
		FailedApikeyIDs: []int64{},
		FailedDetails:   []string{},
	}

	if len(basicKeys) > 0 {
		for _, key := range basicKeys {
			err := s.CreateServiceAccountFromApikey(ctx, key)
			if err != nil {
				s.log.Error("Migating to service accounts failed with error", err.Error())
				migrationResult.Failed++
				migrationResult.FailedDetails = append(migrationResult.FailedDetails, fmt.Sprintf("API key name: %s - Error: %s", key.Name, err.Error()))
				migrationResult.FailedApikeyIDs = append(migrationResult.FailedApikeyIDs, key.ID)
			} else {
				migrationResult.Migrated++
				s.log.Debug("API key converted to service account token", "keyId", key.ID)
			}
		}
	}
	return migrationResult, nil
}

func (s *ServiceAccountsStoreImpl) CreateServiceAccountFromApikey(ctx context.Context, key *apikey.APIKey) error {
	prefix := "sa-autogen"
	cmd := user.CreateUserCommand{
		Login:            generateLogin(prefix, key.OrgID, key.Name),
		Name:             fmt.Sprintf("%v-%v", prefix, key.Name),
		OrgID:            key.OrgID,
		DefaultOrgRole:   string(key.Role),
		IsServiceAccount: true,
	}

	// maximum number of attempts for creating a service account
	attempts := 10

	return s.sqlStore.InTransaction(ctx, func(tctx context.Context) error {
		newSA, errCreateSA := s.userService.CreateServiceAccount(tctx, &cmd)
		if errCreateSA != nil {
			if errors.Is(errCreateSA, serviceaccounts.ErrServiceAccountAlreadyExists) {
				// The service account we tried to create already exists with that login name. We will attempt to create
				// a unique service account by adding suffixes to the initial login name (e.g. -001, -002, ... , -010).
				for i := 1; errCreateSA != nil && i <= attempts; i++ {
					serviceAccountName := fmt.Sprintf("%s-%03d", key.Name, i)
					cmd.Login = generateLogin(prefix, key.OrgID, serviceAccountName)
					newSA, errCreateSA = s.userService.CreateServiceAccount(tctx, &cmd)
					if errCreateSA != nil && !errors.Is(errCreateSA, serviceaccounts.ErrServiceAccountAlreadyExists) {
						break
					}
				}
			}
		}

		if errCreateSA != nil {
			return fmt.Errorf("failed to create service account: %w", errCreateSA)
		}

		return s.assignApiKeyToServiceAccount(tctx, key.ID, newSA.ID)
	})
}

func serviceAccountDeletions(dialect migrator.Dialect) []string {
	deletes := []string{
		"DELETE FROM star WHERE user_id = ?",
		"DELETE FROM " + dialect.Quote("user") + " WHERE id = ?",
		"DELETE FROM org_user WHERE user_id = ?",
		"DELETE FROM preferences WHERE user_id = ?",
		"DELETE FROM team_member WHERE user_id = ?",
		"DELETE FROM user_auth WHERE user_id = ?",
		"DELETE FROM user_auth_token WHERE user_id = ?",
		"DELETE FROM quota WHERE user_id = ?",
	}
	return deletes
}

package database

//nolint:goimports
import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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

func (s *ServiceAccountsStoreImpl) CreateServiceAccount(ctx context.Context, orgID int64, name string) (saDTO *serviceaccounts.ServiceAccountDTO, err error) {
	generatedLogin := "sa-" + strings.ToLower(name)
	generatedLogin = strings.ReplaceAll(generatedLogin, " ", "-")
	cmd := models.CreateUserCommand{
		Login:            generatedLogin,
		OrgId:            orgID,
		Name:             name,
		IsServiceAccount: true,
	}

	newuser, err := s.sqlStore.CreateUser(ctx, cmd)
	if err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			return nil, &ErrSAInvalidName{}
		}
		return nil, fmt.Errorf("failed to create service account: %w", err)
	}

	return &serviceaccounts.ServiceAccountDTO{
		Id:     newuser.Id,
		Name:   newuser.Name,
		Login:  newuser.Login,
		OrgId:  newuser.OrgId,
		Tokens: 0,
	}, nil
}
func ServiceAccountDeletions() []string {
	deletes := []string{
		"DELETE FROM api_key WHERE service_account_id = ?",
	}
	deletes = append(deletes, sqlstore.UserDeletions()...)
	return deletes
}

func (s *ServiceAccountsStoreImpl) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		user := models.User{}
		has, err := sess.Where(`org_id = ? and id = ? and is_service_account = ?`,
			orgID, serviceAccountID, s.sqlStore.Dialect.BooleanStr(true)).Get(&user)
		if err != nil {
			return err
		}
		if !has {
			return serviceaccounts.ErrServiceAccountNotFound
		}
		for _, sql := range ServiceAccountDeletions() {
			_, err := sess.Exec(sql, user.Id)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *ServiceAccountsStoreImpl) UpgradeServiceAccounts(ctx context.Context) error {
	basicKeys := s.sqlStore.GetAllOrgsAPIKeys(ctx)
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
	basicKeys := s.sqlStore.GetAllOrgsAPIKeys(ctx)
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
	prefix := "sa-autogen-"
	cmd := models.CreateUserCommand{
		Login:            fmt.Sprintf("%v-%v-%v", prefix, key.OrgId, key.Name),
		Name:             prefix + key.Name,
		OrgId:            key.OrgId,
		DefaultOrgRole:   string(key.Role),
		IsServiceAccount: true,
	}

	newSA, errCreateSA := s.sqlStore.CreateUser(ctx, cmd)
	if errCreateSA != nil {
		return fmt.Errorf("failed to create service account: %w", errCreateSA)
	}

	if errUpdateKey := s.assignApiKeyToServiceAccount(ctx, key.Id, newSA.Id); errUpdateKey != nil {
		return fmt.Errorf(
			"failed to attach new service account to API key for keyId: %d and newServiceAccountId: %d with error: %w",
			key.Id, newSA.Id, errUpdateKey,
		)
	}

	s.log.Debug("Updated basic api key", "keyId", key.Id, "newServiceAccountId", newSA.Id)

	return nil
}

//nolint:gosimple
func (s *ServiceAccountsStoreImpl) ListTokens(ctx context.Context, orgID int64, serviceAccountID int64) ([]*models.ApiKey, error) {
	result := make([]*models.ApiKey, 0)
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var sess *xorm.Session

		quotedUser := s.sqlStore.Dialect.Quote("user")
		sess = dbSession.
			Join("inner", quotedUser, quotedUser+".id = api_key.service_account_id").
			Where(quotedUser+".org_id=? AND "+quotedUser+".id=?", orgID, serviceAccountID).
			Asc("api_key.name")

		return sess.Find(&result)
	})
	return result, err
}

// RetrieveServiceAccountByID returns a service account by its ID
func (s *ServiceAccountsStoreImpl) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	serviceAccount := &serviceaccounts.ServiceAccountProfileDTO{}

	err := s.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sess := dbSession.Table("org_user")
		sess.Join("INNER", s.sqlStore.Dialect.Quote("user"),
			fmt.Sprintf("org_user.user_id=%s.id", s.sqlStore.Dialect.Quote("user")))

		whereConditions := make([]string, 0, 3)
		whereParams := make([]interface{}, 0)

		whereConditions = append(whereConditions, "org_user.org_id = ?")
		whereParams = append(whereParams, orgID)

		whereConditions = append(whereConditions, "org_user.user_id = ?")
		whereParams = append(whereParams, serviceAccountID)

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

	if err != nil {
		return nil, err
	}

	// Get Teams of service account. Can be optimized by combining with the query above
	// in refactor
	getTeamQuery := models.GetTeamsByUserQuery{UserId: serviceAccountID, OrgId: orgID}
	if err := s.sqlStore.GetTeamsByUser(ctx, &getTeamQuery); err != nil {
		return nil, err
	}
	teams := make([]string, len(getTeamQuery.Result))

	for i := range getTeamQuery.Result {
		teams[i] = getTeamQuery.Result[i].Name
	}

	serviceAccount.Teams = teams

	return serviceAccount, nil
}

func (s *ServiceAccountsStoreImpl) UpdateServiceAccount(ctx context.Context,
	orgID, serviceAccountID int64,
	saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	updatedUser := &serviceaccounts.ServiceAccountProfileDTO{}

	err := s.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		updatedUser, err = s.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
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

			if _, err := sess.Where("org_id = ? AND user_id = ?", orgID, serviceAccountID).Update(&orgUser); err != nil {
				return err
			}

			updatedUser.Role = string(*saForm.Role)
		}

		if saForm.Name != nil || saForm.IsDisabled != nil {
			user := models.User{
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

			if _, err := sess.ID(serviceAccountID).Update(&user); err != nil {
				return err
			}
		}

		return nil
	})

	return updatedUser, err
}

func (s *ServiceAccountsStoreImpl) SearchOrgServiceAccounts(
	ctx context.Context, orgID int64, query string, filter serviceaccounts.ServiceAccountFilter, page int, limit int,
	signedInUser *models.SignedInUser,
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
		whereParams = append(whereParams, orgID)

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

func contains(s []int64, e int64) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

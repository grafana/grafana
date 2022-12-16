package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
)

type TestUser struct {
	Name             string
	Role             string
	Login            string
	IsServiceAccount bool
	OrgID            int64
}

type TestApiKey struct {
	Name             string
	Role             org.RoleType
	OrgId            int64
	Key              string
	IsExpired        bool
	ServiceAccountID *int64
}

func SetupUserServiceAccount(t *testing.T, sqlStore *sqlstore.SQLStore, testUser TestUser) *user.User {
	role := string(org.RoleViewer)
	if testUser.Role != "" {
		role = testUser.Role
	}

	quotaService := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService)
	require.NoError(t, err)

	u1, err := usrSvc.CreateUserForTests(context.Background(), &user.CreateUserCommand{
		Login:            testUser.Login,
		IsServiceAccount: testUser.IsServiceAccount,
		DefaultOrgRole:   role,
		Name:             testUser.Name,
		OrgID:            testUser.OrgID,
	})
	require.NoError(t, err)
	return u1
}

func SetupApiKey(t *testing.T, sqlStore *sqlstore.SQLStore, testKey TestApiKey) *apikey.APIKey {
	role := org.RoleViewer
	if testKey.Role != "" {
		role = testKey.Role
	}

	addKeyCmd := &apikey.AddCommand{
		Name:             testKey.Name,
		Role:             role,
		OrgId:            testKey.OrgId,
		ServiceAccountID: testKey.ServiceAccountID,
	}

	if testKey.Key != "" {
		addKeyCmd.Key = testKey.Key
	} else {
		addKeyCmd.Key = "secret"
	}

	quotaService := quotatest.New(false, nil)
	apiKeyService, err := apikeyimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	err = apiKeyService.AddAPIKey(context.Background(), addKeyCmd)
	require.NoError(t, err)

	if testKey.IsExpired {
		err := sqlStore.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
			// Force setting expires to time before now to make key expired
			var expires int64 = 1
			key := apikey.APIKey{Expires: &expires}
			rowsAffected, err := sess.ID(addKeyCmd.Result.Id).Update(&key)
			require.Equal(t, int64(1), rowsAffected)
			return err
		})
		require.NoError(t, err)
	}

	return addKeyCmd.Result
}

// Service implements the API exposed methods for service accounts.
type serviceAccountStore interface {
	CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error)
	RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error)
	UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
		saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error)
	SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error)
	ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	GetAPIKeysMigrationStatus(ctx context.Context, orgID int64) (*serviceaccounts.APIKeysMigrationStatus, error)
	HideApiKeysTab(ctx context.Context, orgID int64) error
	MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) error
	MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error
	RevertApiKey(ctx context.Context, saId int64, keyId int64) error
	// Service account tokens
	AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) error
	DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error
}

// create mock for serviceaccountservice
type ServiceAccountMock struct {
	Store             serviceAccountStore
	Calls             Calls
	Stats             *serviceaccounts.Stats
	SecretScanEnabled bool
	ExpectedTokens    []apikey.APIKey
	ExpectedError     error
}

func (s *ServiceAccountMock) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	s.Calls.CreateServiceAccount = append(s.Calls.CreateServiceAccount, []interface{}{ctx, orgID, saForm})
	return s.Store.CreateServiceAccount(ctx, orgID, saForm)
}
func (s *ServiceAccountMock) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	s.Calls.DeleteServiceAccount = append(s.Calls.DeleteServiceAccount, []interface{}{ctx, orgID, serviceAccountID})
	return s.Store.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}

func (s *ServiceAccountMock) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	s.Calls.RetrieveServiceAccount = append(s.Calls.RetrieveServiceAccount, []interface{}{ctx, orgID, serviceAccountID})
	return s.Store.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
}

func (s *ServiceAccountMock) UpdateServiceAccount(ctx context.Context,
	orgID, serviceAccountID int64,
	saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	s.Calls.UpdateServiceAccount = append(s.Calls.UpdateServiceAccount, []interface{}{ctx, orgID, serviceAccountID, saForm})
	return s.Store.UpdateServiceAccount(ctx, orgID, serviceAccountID, saForm)
}

func (s *ServiceAccountMock) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return 0, nil
}
func (s *ServiceAccountMock) Migrated(ctx context.Context, orgID int64) bool {
	return false
}

func SetupMockAccesscontrol(t *testing.T,
	userpermissionsfunc func(c context.Context, siu *user.SignedInUser, opt accesscontrol.Options) ([]accesscontrol.Permission, error),
	disableAccessControl bool) *accesscontrolmock.Mock {
	t.Helper()
	acmock := accesscontrolmock.New()
	if disableAccessControl {
		acmock = acmock.WithDisabled()
	}
	acmock.GetUserPermissionsFunc = userpermissionsfunc
	return acmock
}

var _ serviceaccounts.Service = new(ServiceAccountMock)

type Calls struct {
	CreateServiceAccount            []interface{}
	RetrieveServiceAccount          []interface{}
	DeleteServiceAccount            []interface{}
	GetAPIKeysMigrationStatus       []interface{}
	HideApiKeysTab                  []interface{}
	MigrateApiKeysToServiceAccounts []interface{}
	MigrateApiKey                   []interface{}
	RevertApiKey                    []interface{}
	ListTokens                      []interface{}
	DeleteServiceAccountToken       []interface{}
	UpdateServiceAccount            []interface{}
	AddServiceAccountToken          []interface{}
	SearchOrgServiceAccounts        []interface{}
	RetrieveServiceAccountIdByName  []interface{}
}

func (s *ServiceAccountMock) HideApiKeysTab(ctx context.Context, orgID int64) error {
	s.Calls.HideApiKeysTab = append(s.Calls.HideApiKeysTab, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountMock) GetAPIKeysMigrationStatus(ctx context.Context, orgID int64) (*serviceaccounts.APIKeysMigrationStatus, error) {
	s.Calls.GetAPIKeysMigrationStatus = append(s.Calls.GetAPIKeysMigrationStatus, []interface{}{ctx})
	return nil, nil
}

func (s *ServiceAccountMock) MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) error {
	s.Calls.MigrateApiKeysToServiceAccounts = append(s.Calls.MigrateApiKeysToServiceAccounts, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountMock) MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error {
	s.Calls.MigrateApiKey = append(s.Calls.MigrateApiKey, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountMock) RevertApiKey(ctx context.Context, saId int64, keyId int64) error {
	s.Calls.RevertApiKey = append(s.Calls.RevertApiKey, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountMock) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	s.Calls.ListTokens = append(s.Calls.ListTokens, []interface{}{ctx, query.OrgID, query.ServiceAccountID})
	return s.ExpectedTokens, s.ExpectedError
}

func (s *ServiceAccountMock) SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error) {
	s.Calls.SearchOrgServiceAccounts = append(s.Calls.SearchOrgServiceAccounts, []interface{}{ctx, query})
	return nil, nil
}

func (s *ServiceAccountMock) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) error {
	s.Calls.AddServiceAccountToken = append(s.Calls.AddServiceAccountToken, []interface{}{ctx, cmd})
	return s.Store.AddServiceAccountToken(ctx, serviceAccountID, cmd)
}

func (s *ServiceAccountMock) DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error {
	s.Calls.DeleteServiceAccountToken = append(s.Calls.DeleteServiceAccountToken, []interface{}{ctx, orgID, serviceAccountID, tokenID})
	return s.Store.DeleteServiceAccountToken(ctx, orgID, serviceAccountID, tokenID)
}

func (s *ServiceAccountMock) GetUsageMetrics(ctx context.Context) (*serviceaccounts.Stats, error) {
	if s.Stats == nil {
		return &serviceaccounts.Stats{}, nil
	}

	return s.Stats, nil
}

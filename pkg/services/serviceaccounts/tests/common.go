package tests

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

type TestUser struct {
	Name             string
	Role             string
	Login            string
	IsServiceAccount bool
}

type TestApiKey struct {
	Name      string
	Role      org.RoleType
	OrgId     int64
	Key       string
	IsExpired bool
}

func SetupUserServiceAccount(t *testing.T, sqlStore *sqlstore.SQLStore, testUser TestUser) *user.User {
	role := string(org.RoleViewer)
	if testUser.Role != "" {
		role = testUser.Role
	}

	u1, err := sqlStore.CreateUser(context.Background(), user.CreateUserCommand{
		Login:            testUser.Login,
		IsServiceAccount: testUser.IsServiceAccount,
		DefaultOrgRole:   role,
		Name:             testUser.Name,
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
		Name:  testKey.Name,
		Role:  role,
		OrgId: testKey.OrgId,
	}

	if testKey.Key != "" {
		addKeyCmd.Key = testKey.Key
	} else {
		addKeyCmd.Key = "secret"
	}

	apiKeyService := apikeyimpl.ProvideService(sqlStore, sqlStore.Cfg)
	err := apiKeyService.AddAPIKey(context.Background(), addKeyCmd)
	require.NoError(t, err)

	if testKey.IsExpired {
		err := sqlStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

// create mock for serviceaccountservice
type ServiceAccountMock struct{}

func (s *ServiceAccountMock) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return 0, nil
}

func (s *ServiceAccountMock) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	return nil, nil
}

func (s *ServiceAccountMock) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	return nil
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

// this is a way to see
// that the Mock implements the store interface
var _ serviceaccounts.Store = new(ServiceAccountsStoreMock)
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

type ServiceAccountsStoreMock struct {
	serviceaccounts.Store
	Stats *serviceaccounts.Stats
	Calls Calls
}

func (s *ServiceAccountsStoreMock) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	s.Calls.RetrieveServiceAccountIdByName = append(s.Calls.RetrieveServiceAccountIdByName, []interface{}{ctx, orgID, name})
	return 0, nil
}

func (s *ServiceAccountsStoreMock) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	// now we can test that the mock has these calls when we call the function
	s.Calls.CreateServiceAccount = append(s.Calls.CreateServiceAccount, []interface{}{ctx, orgID, saForm})
	return nil, nil
}

func (s *ServiceAccountsStoreMock) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	// now we can test that the mock has these calls when we call the function
	s.Calls.DeleteServiceAccount = append(s.Calls.DeleteServiceAccount, []interface{}{ctx, orgID, serviceAccountID})
	return nil
}

func (s *ServiceAccountsStoreMock) HideApiKeysTab(ctx context.Context, orgID int64) error {
	s.Calls.HideApiKeysTab = append(s.Calls.HideApiKeysTab, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountsStoreMock) GetAPIKeysMigrationStatus(ctx context.Context, orgID int64) (*serviceaccounts.APIKeysMigrationStatus, error) {
	s.Calls.GetAPIKeysMigrationStatus = append(s.Calls.GetAPIKeysMigrationStatus, []interface{}{ctx})
	return nil, nil
}

func (s *ServiceAccountsStoreMock) MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) error {
	s.Calls.MigrateApiKeysToServiceAccounts = append(s.Calls.MigrateApiKeysToServiceAccounts, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountsStoreMock) MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error {
	s.Calls.MigrateApiKey = append(s.Calls.MigrateApiKey, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountsStoreMock) RevertApiKey(ctx context.Context, saId int64, keyId int64) error {
	s.Calls.RevertApiKey = append(s.Calls.RevertApiKey, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountsStoreMock) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	s.Calls.ListTokens = append(s.Calls.ListTokens, []interface{}{ctx, query.OrgID, query.ServiceAccountID})
	return nil, nil
}

func (s *ServiceAccountsStoreMock) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	s.Calls.RetrieveServiceAccount = append(s.Calls.RetrieveServiceAccount, []interface{}{ctx, orgID, serviceAccountID})
	return nil, nil
}

func (s *ServiceAccountsStoreMock) UpdateServiceAccount(ctx context.Context,
	orgID, serviceAccountID int64,
	saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	s.Calls.UpdateServiceAccount = append(s.Calls.UpdateServiceAccount, []interface{}{ctx, orgID, serviceAccountID, saForm})

	return nil, nil
}

func (s *ServiceAccountsStoreMock) SearchOrgServiceAccounts(
	ctx context.Context,
	orgID int64,
	query string,
	filter serviceaccounts.ServiceAccountFilter,
	page int,
	limit int,
	user *user.SignedInUser) (*serviceaccounts.SearchServiceAccountsResult, error) {
	s.Calls.SearchOrgServiceAccounts = append(s.Calls.SearchOrgServiceAccounts, []interface{}{ctx, orgID, query, page, limit, user})
	return nil, nil
}

func (s *ServiceAccountsStoreMock) DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error {
	s.Calls.DeleteServiceAccountToken = append(s.Calls.DeleteServiceAccountToken, []interface{}{ctx, orgID, serviceAccountID, tokenID})
	return nil
}

func (s *ServiceAccountsStoreMock) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) error {
	s.Calls.AddServiceAccountToken = append(s.Calls.AddServiceAccountToken, []interface{}{ctx, cmd})
	return nil
}

func (s *ServiceAccountsStoreMock) GetUsageMetrics(ctx context.Context) (*serviceaccounts.Stats, error) {
	if s.Stats == nil {
		return &serviceaccounts.Stats{}, nil
	}

	return s.Stats, nil
}

package tests

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

type TestUser struct {
	Name             string
	Role             string
	Login            string
	IsServiceAccount bool
}

func SetupUserServiceAccount(t *testing.T, sqlStore *sqlstore.SQLStore, testUser TestUser) *models.User {
	role := string(models.ROLE_VIEWER)
	if testUser.Role != "" {
		role = testUser.Role
	}

	u1, err := sqlStore.CreateUser(context.Background(), models.CreateUserCommand{
		Login:            testUser.Login,
		IsServiceAccount: testUser.IsServiceAccount,
		DefaultOrgRole:   role,
		Name:             testUser.Name,
	})
	require.NoError(t, err)
	return u1
}

// create mock for serviceaccountservice
type ServiceAccountMock struct{}

func (s *ServiceAccountMock) CreateServiceAccount(ctx context.Context, orgID int64, name string) (*serviceaccounts.ServiceAccountDTO, error) {
	return nil, nil
}

func (s *ServiceAccountMock) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	return nil
}

func (s *ServiceAccountMock) Migrated(ctx context.Context, orgID int64) bool {
	return false
}

func SetupMockAccesscontrol(t *testing.T,
	userpermissionsfunc func(c context.Context, siu *models.SignedInUser, opt accesscontrol.Options) ([]*accesscontrol.Permission, error),
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

type Calls struct {
	CreateServiceAccount      []interface{}
	ListServiceAccounts       []interface{}
	RetrieveServiceAccount    []interface{}
	DeleteServiceAccount      []interface{}
	UpgradeServiceAccounts    []interface{}
	ConvertServiceAccounts    []interface{}
	ListTokens                []interface{}
	DeleteServiceAccountToken []interface{}
	UpdateServiceAccount      []interface{}
	AddServiceAccountToken    []interface{}
	SearchOrgServiceAccounts  []interface{}
}

type ServiceAccountsStoreMock struct {
	Calls Calls
}

func (s *ServiceAccountsStoreMock) CreateServiceAccount(ctx context.Context, orgID int64, name string) (*serviceaccounts.ServiceAccountDTO, error) {
	// now we can test that the mock has these calls when we call the function
	s.Calls.CreateServiceAccount = append(s.Calls.CreateServiceAccount, []interface{}{ctx, orgID, name})
	return nil, nil
}

func (s *ServiceAccountsStoreMock) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	// now we can test that the mock has these calls when we call the function
	s.Calls.DeleteServiceAccount = append(s.Calls.DeleteServiceAccount, []interface{}{ctx, orgID, serviceAccountID})
	return nil
}

func (s *ServiceAccountsStoreMock) UpgradeServiceAccounts(ctx context.Context) error {
	s.Calls.UpgradeServiceAccounts = append(s.Calls.UpgradeServiceAccounts, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountsStoreMock) ConvertToServiceAccounts(ctx context.Context, keys []int64) error {
	s.Calls.ConvertServiceAccounts = append(s.Calls.ConvertServiceAccounts, []interface{}{ctx})
	return nil
}

func (s *ServiceAccountsStoreMock) ListTokens(ctx context.Context, orgID int64, serviceAccount int64) ([]*models.ApiKey, error) {
	s.Calls.ListTokens = append(s.Calls.ListTokens, []interface{}{ctx, orgID, serviceAccount})
	return nil, nil
}
func (s *ServiceAccountsStoreMock) ListServiceAccounts(ctx context.Context, orgID int64, serviceAccountID int64) ([]*serviceaccounts.ServiceAccountDTO, error) {
	s.Calls.ListServiceAccounts = append(s.Calls.ListServiceAccounts, []interface{}{ctx, orgID})
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

func (s *ServiceAccountsStoreMock) SearchOrgServiceAccounts(ctx context.Context, query *models.SearchOrgUsersQuery) ([]*serviceaccounts.ServiceAccountDTO, error) {
	s.Calls.SearchOrgServiceAccounts = append(s.Calls.SearchOrgServiceAccounts, []interface{}{ctx, query})
	return nil, nil
}

func (s *ServiceAccountsStoreMock) DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error {
	s.Calls.DeleteServiceAccountToken = append(s.Calls.DeleteServiceAccountToken, []interface{}{ctx, orgID, serviceAccountID, tokenID})
	return nil
}

func (s *ServiceAccountsStoreMock) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *models.AddApiKeyCommand) error {
	s.Calls.AddServiceAccountToken = append(s.Calls.AddServiceAccountToken, []interface{}{ctx, cmd})
	return nil
}

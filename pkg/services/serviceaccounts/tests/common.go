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
	Login            string
	IsServiceAccount bool
}

func SetupUserServiceAccount(t *testing.T, sqlStore *sqlstore.SQLStore, testUser TestUser) *models.User {
	u1, err := sqlStore.CreateUser(context.Background(), models.CreateUserCommand{
		Login:            testUser.Login,
		IsServiceAccount: testUser.IsServiceAccount,
	})
	require.NoError(t, err)
	return u1
}

// create mock for serviceaccountservice
type ServiceAccountMock struct{}

func (s *ServiceAccountMock) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	return nil
}

func SetupMockAccesscontrol(t *testing.T, userpermissionsfunc func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error), disableAccessControl bool) *accesscontrolmock.Mock {
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
	DeleteServiceAccount []interface{}
}

type ServiceAccountsStoreMock struct {
	Calls Calls
}

func (s *ServiceAccountsStoreMock) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	// now we can test that the mock has these calls when we call the function
	s.Calls.DeleteServiceAccount = append(s.Calls.DeleteServiceAccount, []interface{}{ctx, orgID, serviceAccountID})
	return nil
}

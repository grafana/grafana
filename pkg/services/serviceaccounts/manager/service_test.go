package manager

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"

	infralog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
)

var (
	deletePermissionPath = "/api/serviceaccounts/%s"
)

type TestUser struct {
	Email            string
	Login            string
	IsServiceAccount bool
}

var (
	testOrgID                 = 1
	testUserServiceAccount    = TestUser{Email: "testuser1@grafana.com", Login: "testuser1", IsServiceAccount: true}
	testUserNotServiceAccount = TestUser{Email: "testuser2@grafana.com", Login: "testuser2", IsServiceAccount: false}
)

func setupUserForTests(sqlStore *sqlstore.SQLStore) (user *models.User, err error) {
	setting.AutoAssignOrg = true
	setting.AutoAssignOrgId = int(testOrgID)
	u1, err := sqlStore.CreateUser(context.Background(), models.CreateUserCommand{
		Email:            testUserServiceAccount.Email,
		Login:            testUserServiceAccount.Login,
		IsServiceAccount: testUserServiceAccount.IsServiceAccount,
		SkipOrgSetup:     true,
	})
	if err != nil {
		return nil, err
	}
	return u1, nil
}

func TestService_DeleteServiceAccount(t *testing.T) {
	db := sqlstore.InitTestDB(t)
	u, err := setupUserForTests(db)
	if err != nil {
		t.Fatalf("unable to setup test accounts for service accounts with err: %s", err)
	}
	routerRegister := routing.NewRouteRegister()
	svc, acmock := setupTestService(t, db, routerRegister, false)
	server := setupServer(t, svc, routerRegister, acmock)

	var getResponse = func(server *macaron.Macaron) *httptest.ResponseRecorder {
		req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf(deletePermissionPath, fmt.Sprint(u.Id)), nil)
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}
	t.Run("Service account should be removed", func(t *testing.T) {
		require.Equal(t, http.StatusForbidden, getResponse(server).Code)
		// TODO: test serviceaccounts deletion where we enable AC and add scope, action to the accesscontrol
	})
}

func setupTestService(t *testing.T, sqlstore *sqlstore.SQLStore, routerRegister routing.RouteRegister, disableAccessControl bool) (*ServiceAccountsService, *accesscontrolmock.Mock) {
	t.Helper()
	acmock := accesscontrolmock.New()
	if disableAccessControl {
		acmock = acmock.WithDisabled()
	}
	svc, err := ProvideServiceAccountsService(
		&setting.Cfg{FeatureToggles: map[string]bool{"service-accounts": true}},
		sqlstore,
		acmock,
		routerRegister,
	)
	if err != nil {
		t.Fatalf("serviceaccounts service could not be created")
	}
	return svc, acmock
}

func setupServer(t *testing.T, svc *ServiceAccountsService, routerRegister routing.RouteRegister, acmock *accesscontrolmock.Mock) *macaron.Macaron {
	a := api.NewServiceAccountsAPI(
		svc,
		acmock,
		routerRegister,
	)
	a.RegisterAPIEndpoints()

	m := macaron.New()
	signedUser := &models.SignedInUser{
		OrgId:   1,
		OrgRole: models.ROLE_ADMIN,
	}

	m.Use(func(c *macaron.Context) {
		ctx := &models.ReqContext{
			Context:      c,
			IsSignedIn:   true,
			SignedInUser: signedUser,
			Logger:       infralog.New("serviceaccounts-test"),
		}
		c.Map(ctx)
	})
	a.RouterRegister.Register(m.Router)
	return m
}

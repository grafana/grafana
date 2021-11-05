package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"
)

var (
	deleteServiceAccountPath = "/api/serviceaccounts/%s"
)

// test the accesscontrol endpoints
// with permissions and without permissions
func TestServiceAccountsAPI_DeleteServiceAccount(t *testing.T) {
	cases := []struct {
		desc         string
		user         tests.TestUser
		acmock       *accesscontrolmock.Mock
		expectedCode int
	}{
		{
			desc: "should be forbidden to delete serviceaccount via accesscontrol on endpoint",
			user: tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		},
		{
			desc: "should be able to delete serviceaccount for with permissions",
			user: tests.TestUser{Login: "servicetest2@admin", IsServiceAccount: true},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		},
	}
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}

	var deleteResponse = func(server *macaron.Macaron, user *models.User) *httptest.ResponseRecorder {
		req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf(deleteServiceAccountPath, fmt.Sprint(user.Id)), nil)
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}

	for _, c := range cases {
		t.Run(c.desc, func(t *testing.T) {
			user := tests.SetupUserServiceAccount(t, store, c.user)
			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), c.acmock)
			actual := deleteResponse(server, user).Code
			if c.expectedCode != actual {
				t.Logf(c.desc)
				t.Errorf("expected %d, actual %d", c.expectedCode, actual)
			}
		})
	}
}

func setupTestServer(t *testing.T, svc *tests.ServiceAccountMock, routerRegister routing.RouteRegister, acmock *accesscontrolmock.Mock) *macaron.Macaron {
	a := NewServiceAccountsAPI(
		svc,
		acmock,
		routerRegister,
	)
	a.RegisterAPIEndpoints(&setting.Cfg{FeatureToggles: map[string]bool{"service-accounts": true}})

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
			Logger:       log.New("serviceaccounts-test"),
		}
		c.Map(ctx)
	})
	a.RouterRegister.Register(m.Router)
	return m
}

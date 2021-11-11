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
	serviceaccountIDPath = "/api/serviceaccounts/%s"
)

// test the accesscontrol endpoints
// with permissions and without permissions
func TestServiceAccountsAPI_DeleteServiceAccount(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}

	var requestResponse = func(server *macaron.Macaron, httpMethod, requestpath string) *httptest.ResponseRecorder {
		req, err := http.NewRequest(httpMethod, requestpath, nil)
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}
	t.Run("should be able to delete serviceaccount for with permissions", func(t *testing.T) {
		testcase := struct {
			user         tests.TestUser
			acmock       *accesscontrolmock.Mock
			expectedCode int
		}{

			user: tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		}
		serviceAccountDeletionScenario(t, http.MethodDelete, serviceaccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock)
			actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, fmt.Sprint(createduser.Id))).Code
			require.Equal(t, testcase.expectedCode, actual)
		})
	})

	t.Run("should be forbidden to delete serviceaccount via accesscontrol on endpoint", func(t *testing.T) {
		testcase := struct {
			user         tests.TestUser
			acmock       *accesscontrolmock.Mock
			expectedCode int
		}{
			user: tests.TestUser{Login: "servicetest2@admin", IsServiceAccount: true},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		}
		serviceAccountDeletionScenario(t, http.MethodDelete, serviceaccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock)
			actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, fmt.Sprint(createduser.Id))).Code
			require.Equal(t, testcase.expectedCode, actual)
		})
	})
}

func serviceAccountDeletionScenario(t *testing.T, httpMethod string, endpoint string, user *tests.TestUser, fn func(httpmethod string, endpoint string, user *tests.TestUser)) {
	t.Helper()
	fn(httpMethod, endpoint, user)
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

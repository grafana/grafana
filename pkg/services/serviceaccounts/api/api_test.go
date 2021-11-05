package api

import (
	"context"
	"encoding/json"
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
	"github.com/stretchr/testify/assert"
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
	}
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}

	loggedInUserScenario(t, "When calling GET on", "api/org/users", func(sc *scenarioContext) {
		setUpGetOrgUsersDB(t, sqlStore)

		sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp []models.OrgUserDTO
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Len(t, resp, 3)
	})

	var deleteresponse = func(server *macaron.Macaron, user *models.User) *httptest.ResponseRecorder {
		req, err := http.NewRequest(http.MethodDelete, "/api/serviceaccounts/", nil)
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

			user: tests.TestUser{Login: "servicetest2@admin", IsServiceAccount: true},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		}
		serviceAccountDeletionScenario(t, "DELETE", "/api/serviceaccounts/", func(httpmethod string, endpoint string) {
			user := tests.SetupUserServiceAccount(t, store, testcase.user)
			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock)
			actual := deleteresponse(server, user).Code
			require.Equal(t, http.StatusForbidden, actual)
		})
	})
}

func serviceAccountDeletionScenario(t *testing.T, httpMethod string, endpoint string, fn func(httpmethod string, endpoint string)) {
	t.Helper()
	fn(httpMethod, endpoint)
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

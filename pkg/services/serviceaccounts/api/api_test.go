package api

import (
	"context"
	"encoding/json"
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
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
)

var (
	serviceaccountIDPath = "/api/org/serviceaccounts/%v"
)

// test the accesscontrol endpoints
// with permissions and without permissions
func TestServiceAccountsAPI_DeleteServiceAccount(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}

	var requestResponse = func(server *web.Mux, httpMethod, requestpath string) *httptest.ResponseRecorder {
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
		serviceAccountRequestScenario(t, http.MethodDelete, serviceaccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock, store)
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
		serviceAccountRequestScenario(t, http.MethodDelete, serviceaccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock, store)
			actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, createduser.Id)).Code
			require.Equal(t, testcase.expectedCode, actual)
		})
	})
}

func serviceAccountRequestScenario(t *testing.T, httpMethod string, endpoint string, user *tests.TestUser, fn func(httpmethod string, endpoint string, user *tests.TestUser)) {
	t.Helper()
	fn(httpMethod, endpoint, user)
}

func setupTestServer(t *testing.T, svc *tests.ServiceAccountMock, routerRegister routing.RouteRegister, acmock *accesscontrolmock.Mock, sqlStore *sqlstore.SQLStore) *web.Mux {
	a := NewServiceAccountsAPI(svc, acmock, routerRegister, database.NewServiceAccountsStore(sqlStore))
	a.RegisterAPIEndpoints(&setting.Cfg{FeatureToggles: map[string]bool{"service-accounts": true}})

	m := web.New()
	signedUser := &models.SignedInUser{
		OrgId:   1,
		OrgRole: models.ROLE_ADMIN,
	}

	m.Use(func(c *web.Context) {
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

func TestServiceAccountsAPI_RetrieveServiceAccount(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}
	type testRetrieveSATestCase struct {
		desc         string
		user         *tests.TestUser
		expectedCode int
		acmock       *accesscontrolmock.Mock
		userID       int
	}
	testCases := []testRetrieveSATestCase{
		{
			desc: "should be ok to retrieve serviceaccount with permissions",
			user: &tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		},
		{
			desc: "should be forbidden to retrieve serviceaccount if no permissions",
			user: &tests.TestUser{Login: "servicetest2@admin", IsServiceAccount: true},
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
			desc:   "should be not found when the user doesnt exist",
			user:   nil,
			userID: 12,
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusNotFound,
		},
	}

	var requestResponse = func(server *web.Mux, httpMethod, requestpath string) *httptest.ResponseRecorder {
		req, err := http.NewRequest(httpMethod, requestpath, nil)
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			serviceAccountRequestScenario(t, http.MethodGet, serviceaccountIDPath, tc.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
				scopeID := tc.userID
				if tc.user != nil {
					createdUser := tests.SetupUserServiceAccount(t, store, *tc.user)
					scopeID = int(createdUser.Id)
				}
				server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store)

				actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, scopeID))

				actualCode := actual.Code
				require.Equal(t, tc.expectedCode, actualCode)

				if actualCode == http.StatusOK {
					actualBody := map[string]interface{}{}
					err := json.Unmarshal(actual.Body.Bytes(), &actualBody)
					require.NoError(t, err)
					require.Equal(t, scopeID, int(actualBody["userId"].(float64)))
					require.Equal(t, tc.user.Login, actualBody["login"].(string))
				}
			})
		})
	}
}

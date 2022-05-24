package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	serviceAccountPath   = "/api/serviceaccounts/"
	serviceAccountIDPath = serviceAccountPath + "%v"
)

func TestServiceAccountsAPI_CreateServiceAccount(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}

	autoAssignOrg := setting.AutoAssignOrg
	setting.AutoAssignOrg = true
	defer func() {
		setting.AutoAssignOrg = autoAssignOrg
	}()

	orgCmd := &models.CreateOrgCommand{Name: "Some Test Org"}
	err := store.CreateOrg(context.Background(), orgCmd)
	require.Nil(t, err)

	type testCreateSATestCase struct {
		desc         string
		body         map[string]interface{}
		expectedCode int
		wantID       string
		wantError    string
		acmock       *accesscontrolmock.Mock
	}
	testCases := []testCreateSATestCase{
		{
			desc:   "should be ok to create serviceaccount with permissions",
			body:   map[string]interface{}{"name": "New SA"},
			wantID: "sa-new-sa",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
				},
				false,
			),
			expectedCode: http.StatusCreated,
		},
		{
			desc:      "not ok - duplicate name",
			body:      map[string]interface{}{"name": "New SA"},
			wantError: "service account name already in use",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
				},
				false,
			),
			expectedCode: http.StatusBadRequest,
		},
		{
			desc:      "not ok - missing name",
			body:      map[string]interface{}{},
			wantError: "required value Name must not be empty",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
				},
				false,
			),
			expectedCode: http.StatusBadRequest,
		},
		{
			desc: "should be forbidden to create serviceaccount if no permissions",
			body: map[string]interface{}{},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		},
	}

	var requestResponse = func(server *web.Mux, httpMethod, requestpath string, body io.Reader) *httptest.ResponseRecorder {
		req, err := http.NewRequest(httpMethod, requestpath, body)
		req.Header.Add("Content-Type", "application/json")
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}

	testUser := &tests.TestUser{}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			serviceAccountRequestScenario(t, http.MethodPost, serviceAccountPath, testUser, func(httpmethod string, endpoint string, user *tests.TestUser) {
				server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, database.NewServiceAccountsStore(store))
				marshalled, err := json.Marshal(tc.body)
				require.NoError(t, err)

				ioReader := bytes.NewReader(marshalled)

				actual := requestResponse(server, httpmethod, endpoint, ioReader)

				actualCode := actual.Code
				actualBody := map[string]interface{}{}

				err = json.Unmarshal(actual.Body.Bytes(), &actualBody)
				require.NoError(t, err)
				require.Equal(t, tc.expectedCode, actualCode, actualBody)

				if actualCode == http.StatusCreated {
					assert.NotEmpty(t, actualBody["id"])
					assert.Equal(t, tc.body["name"], actualBody["name"].(string))
					assert.Equal(t, tc.wantID, actualBody["login"].(string))
				} else if actualCode == http.StatusBadRequest {
					assert.Contains(t, tc.wantError, actualBody["error"].(string))
				}
			})
		})
	}
}

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
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		}
		serviceAccountRequestScenario(t, http.MethodDelete, serviceAccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock, store, database.NewServiceAccountsStore(store))
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
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		}
		serviceAccountRequestScenario(t, http.MethodDelete, serviceAccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock, store, database.NewServiceAccountsStore(store))
			actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, createduser.Id)).Code
			require.Equal(t, testcase.expectedCode, actual)
		})
	})
}

func serviceAccountRequestScenario(t *testing.T, httpMethod string, endpoint string, user *tests.TestUser, fn func(httpmethod string, endpoint string, user *tests.TestUser)) {
	t.Helper()
	fn(httpMethod, endpoint, user)
}

func setupTestServer(t *testing.T, svc *tests.ServiceAccountMock,
	routerRegister routing.RouteRegister,
	acmock *accesscontrolmock.Mock,
	sqlStore *sqlstore.SQLStore, saStore serviceaccounts.Store) (*web.Mux, *ServiceAccountsAPI) {
	a := NewServiceAccountsAPI(setting.NewCfg(), svc, acmock, routerRegister, saStore)
	a.RegisterAPIEndpoints(featuremgmt.WithFeatures(featuremgmt.FlagServiceAccounts))

	a.cfg.ApiKeyMaxSecondsToLive = -1 // disable api key expiration

	m := web.New()
	signedUser := &models.SignedInUser{
		OrgId:   1,
		OrgRole: models.ROLE_VIEWER,
	}

	m.Use(func(c *web.Context) {
		ctx := &models.ReqContext{
			Context:      c,
			IsSignedIn:   true,
			SignedInUser: signedUser,
			Logger:       log.New("serviceaccounts-test"),
		}
		c.Map(ctx)

		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), ctx))
		c.Map(c.Req)
	})
	a.RouterRegister.Register(m.Router)
	return m, a
}

func TestServiceAccountsAPI_RetrieveServiceAccount(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}
	type testRetrieveSATestCase struct {
		desc         string
		user         *tests.TestUser
		expectedCode int
		acmock       *accesscontrolmock.Mock
		Id           int
	}
	testCases := []testRetrieveSATestCase{
		{
			desc: "should be ok to retrieve serviceaccount with permissions",
			user: &tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
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
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		},
		{
			desc: "should be not found when the user doesnt exist",
			user: nil,
			Id:   12,
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
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
			serviceAccountRequestScenario(t, http.MethodGet, serviceAccountIDPath, tc.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
				scopeID := tc.Id
				if tc.user != nil {
					createdUser := tests.SetupUserServiceAccount(t, store, *tc.user)
					scopeID = int(createdUser.Id)
				}
				server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, database.NewServiceAccountsStore(store))

				actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, scopeID))

				actualCode := actual.Code
				require.Equal(t, tc.expectedCode, actualCode)

				if actualCode == http.StatusOK {
					actualBody := map[string]interface{}{}
					err := json.Unmarshal(actual.Body.Bytes(), &actualBody)
					require.NoError(t, err)
					require.Equal(t, scopeID, int(actualBody["id"].(float64)))
					require.Equal(t, tc.user.Login, actualBody["login"].(string))
				}
			})
		})
	}
}

func newString(s string) *string {
	return &s
}

func TestServiceAccountsAPI_UpdateServiceAccount(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}
	type testUpdateSATestCase struct {
		desc         string
		user         *tests.TestUser
		expectedCode int
		acmock       *accesscontrolmock.Mock
		body         *serviceaccounts.UpdateServiceAccountForm
		Id           int
	}

	viewerRole := models.ROLE_VIEWER
	editorRole := models.ROLE_EDITOR
	var invalidRole models.RoleType = "InvalidRole"
	testCases := []testUpdateSATestCase{
		{
			desc: "should be ok to update serviceaccount with permissions",
			user: &tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true, Role: "Viewer", Name: "Unaltered"},
			body: &serviceaccounts.UpdateServiceAccountForm{Name: newString("New Name"), Role: &viewerRole},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		},
		{
			desc: "should be forbidden to set role higher than user's role",
			user: &tests.TestUser{Login: "servicetest2@admin", IsServiceAccount: true, Role: "Viewer", Name: "Unaltered 2"},
			body: &serviceaccounts.UpdateServiceAccountForm{Name: newString("New Name 2"), Role: &editorRole},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		},
		{
			desc: "bad request when invalid role",
			user: &tests.TestUser{Login: "servicetest3@admin", IsServiceAccount: true, Role: "Invalid", Name: "Unaltered"},
			body: &serviceaccounts.UpdateServiceAccountForm{Name: newString("NameB"), Role: &invalidRole},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusBadRequest,
		},
		{
			desc: "should be forbidden to update serviceaccount if no permissions",
			user: &tests.TestUser{Login: "servicetest4@admin", IsServiceAccount: true},
			body: nil,
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		},
		{
			desc: "should be not found when the user doesnt exist",
			user: nil,
			body: nil,
			Id:   12,
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusNotFound,
		},
	}

	var requestResponse = func(server *web.Mux, httpMethod, requestpath string, body io.Reader) *httptest.ResponseRecorder {
		req, err := http.NewRequest(httpMethod, requestpath, body)
		req.Header.Add("Content-Type", "application/json")
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			server, saAPI := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, database.NewServiceAccountsStore(store))
			scopeID := tc.Id
			if tc.user != nil {
				createdUser := tests.SetupUserServiceAccount(t, store, *tc.user)
				scopeID = int(createdUser.Id)
			}

			var rawBody io.Reader = http.NoBody
			if tc.body != nil {
				body, err := json.Marshal(tc.body)
				require.NoError(t, err)
				rawBody = bytes.NewReader(body)
			}

			actual := requestResponse(server, http.MethodPatch, fmt.Sprintf(serviceAccountIDPath, scopeID), rawBody)

			actualCode := actual.Code
			require.Equal(t, tc.expectedCode, actualCode)

			if actualCode == http.StatusOK {
				actualBody := map[string]interface{}{}
				err := json.Unmarshal(actual.Body.Bytes(), &actualBody)
				require.NoError(t, err)
				assert.Equal(t, scopeID, int(actualBody["id"].(float64)))
				assert.Equal(t, string(*tc.body.Role), actualBody["role"].(string))
				assert.Equal(t, *tc.body.Name, actualBody["name"].(string))
				assert.Equal(t, tc.user.Login, actualBody["login"].(string))

				// Ensure the user was updated in DB
				sa, err := saAPI.store.RetrieveServiceAccount(context.Background(), 1, int64(scopeID))
				require.NoError(t, err)
				require.Equal(t, *tc.body.Name, sa.Name)
				require.Equal(t, string(*tc.body.Role), sa.Role)
			}
		})
	}
}

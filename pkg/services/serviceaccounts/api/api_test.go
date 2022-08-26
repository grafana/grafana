package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
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
	apiKeyService := apikeyimpl.ProvideService(store, store.Cfg)
	kvStore := kvstore.ProvideService(store)
	saStore := database.ProvideServiceAccountsStore(store, apiKeyService, kvStore)
	svcmock := tests.ServiceAccountMock{}

	autoAssignOrg := store.Cfg.AutoAssignOrg
	store.Cfg.AutoAssignOrg = true
	defer func() {
		store.Cfg.AutoAssignOrg = autoAssignOrg
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
			desc:   "should be ok to create service account with permissions",
			body:   map[string]interface{}{"name": "New SA", "role": "Viewer", "is_disabled": "false"},
			wantID: "sa-new-sa",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
				},
				false,
			),
			expectedCode: http.StatusCreated,
		},
		{
			desc:   "should fail to create a service account with higher privilege",
			body:   map[string]interface{}{"name": "New SA HP", "role": "Admin"},
			wantID: "sa-new-sa-hp",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		},
		{
			desc:      "should fail to create a service account with invalid role",
			body:      map[string]interface{}{"name": "New SA", "role": "Random"},
			wantID:    "sa-new-sa",
			wantError: "invalid role value: Random",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
				},
				false,
			),
			expectedCode: http.StatusBadRequest,
		},
		{
			desc:      "not ok - duplicate name",
			body:      map[string]interface{}{"name": "New SA"},
			wantError: "service account already exists",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}}, nil
				},
				false,
			),
			expectedCode: http.StatusBadRequest,
		},
		{
			desc: "should be forbidden to create service account if no permissions",
			body: map[string]interface{}{},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{}, nil
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
			serviceAccountRequestScenario(t, http.MethodPost, serviceAccountPath, testUser, func(httpmethod string, endpoint string, usr *tests.TestUser) {
				server, api := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, saStore)
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
					sa := serviceaccounts.ServiceAccountDTO{}
					err = json.Unmarshal(actual.Body.Bytes(), &sa)
					require.NoError(t, err)
					assert.NotZero(t, sa.Id)
					assert.Equal(t, tc.body["name"], sa.Name)
					assert.Equal(t, tc.wantID, sa.Login)
					tempUser := &user.SignedInUser{
						OrgID:  1,
						UserID: 1,
						Permissions: map[int64]map[string][]string{
							1: {
								serviceaccounts.ActionRead:       []string{serviceaccounts.ScopeAll},
								accesscontrol.ActionOrgUsersRead: []string{accesscontrol.ScopeUsersAll},
							},
						},
					}
					perms, err := api.permissionService.GetPermissions(context.Background(), tempUser, strconv.FormatInt(sa.Id, 10))
					assert.NoError(t, err)
					assert.Equal(t, 1, len(perms), "should have added managed permissions for SA creator")
					assert.Equal(t, int64(1), perms[0].ID)
					assert.Equal(t, int64(1), perms[0].UserId)
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
	kvStore := kvstore.ProvideService(store)
	apiKeyService := apikeyimpl.ProvideService(store, store.Cfg)
	saStore := database.ProvideServiceAccountsStore(store, apiKeyService, kvStore)
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		}
		serviceAccountRequestScenario(t, http.MethodDelete, serviceAccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock, store, saStore)
			actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, fmt.Sprint(createduser.ID))).Code
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		}
		serviceAccountRequestScenario(t, http.MethodDelete, serviceAccountIDPath, &testcase.user, func(httpmethod string, endpoint string, user *tests.TestUser) {
			createduser := tests.SetupUserServiceAccount(t, store, testcase.user)
			server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), testcase.acmock, store, saStore)
			actual := requestResponse(server, httpmethod, fmt.Sprintf(endpoint, createduser.ID)).Code
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
	cfg := setting.NewCfg()
	saPermissionService, err := ossaccesscontrol.ProvideServiceAccountPermissions(cfg, routing.NewRouteRegister(), sqlStore, acmock, &licensing.OSSLicensingService{}, saStore, acmock)
	require.NoError(t, err)

	a := NewServiceAccountsAPI(cfg, svc, acmock, routerRegister, saStore, saPermissionService)
	a.RegisterAPIEndpoints()

	a.cfg.ApiKeyMaxSecondsToLive = -1 // disable api key expiration

	m := web.New()
	signedUser := &user.SignedInUser{
		OrgID:   1,
		UserID:  1,
		OrgRole: org.RoleViewer,
	}

	m.Use(func(c *web.Context) {
		ctx := &models.ReqContext{
			Context:      c,
			IsSignedIn:   true,
			SignedInUser: signedUser,
			Logger:       log.New("serviceaccounts-test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), ctx))
	})
	a.RouterRegister.Register(m.Router)
	return m, a
}

func TestServiceAccountsAPI_RetrieveServiceAccount(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	apiKeyService := apikeyimpl.ProvideService(store, store.Cfg)
	kvStore := kvstore.ProvideService(store)
	saStore := database.ProvideServiceAccountsStore(store, apiKeyService, kvStore)
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: serviceaccounts.ScopeAll}}, nil
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{}, nil
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: serviceaccounts.ScopeAll}}, nil
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
					scopeID = int(createdUser.ID)
				}
				server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, saStore)

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
	apiKeyService := apikeyimpl.ProvideService(store, store.Cfg)
	kvStore := kvstore.ProvideService(store)
	saStore := database.ProvideServiceAccountsStore(store, apiKeyService, kvStore)
	svcmock := tests.ServiceAccountMock{}
	type testUpdateSATestCase struct {
		desc         string
		user         *tests.TestUser
		expectedCode int
		acmock       *accesscontrolmock.Mock
		body         *serviceaccounts.UpdateServiceAccountForm
		Id           int
	}

	viewerRole := org.RoleViewer
	editorRole := org.RoleEditor
	var invalidRole org.RoleType = "InvalidRole"
	testCases := []testUpdateSATestCase{
		{
			desc: "should be ok to update serviceaccount with permissions",
			user: &tests.TestUser{Login: "servicetest1@admin", IsServiceAccount: true, Role: "Viewer", Name: "Unaltered"},
			body: &serviceaccounts.UpdateServiceAccountForm{Name: newString("New Name"), Role: &viewerRole},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{}, nil
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
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
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
			server, saAPI := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, saStore)
			scopeID := tc.Id
			if tc.user != nil {
				createdUser := tests.SetupUserServiceAccount(t, store, *tc.user)
				scopeID = int(createdUser.ID)
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
				assert.Equal(t, *tc.body.Name, actualBody["name"].(string))
				serviceAccountData := actualBody["serviceaccount"].(map[string]interface{})
				assert.Equal(t, string(*tc.body.Role), serviceAccountData["role"].(string))
				assert.Equal(t, tc.user.Login, serviceAccountData["login"].(string))

				// Ensure the user was updated in DB
				sa, err := saAPI.store.RetrieveServiceAccount(context.Background(), 1, int64(scopeID))
				require.NoError(t, err)
				require.Equal(t, *tc.body.Name, sa.Name)
				require.Equal(t, string(*tc.body.Role), sa.Role)
			}
		})
	}
}

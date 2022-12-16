package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeyimpl"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/retriever"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestServiceAccountsAPI_CreateServiceAccount(t *testing.T) {
	type TestCase struct {
		desc         string
		basicRole    org.RoleType
		permissions  []accesscontrol.Permission
		body         string
		expectedCode int
		expectedSA   *serviceaccounts.ServiceAccountDTO
		expectedErr  error
	}

	tests := []TestCase{
		{
			desc:        "should be able to create service account with correct permission",
			basicRole:   org.RoleViewer,
			permissions: []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}},
			body:        `{"name": "test", "isDisabled": false, "role": "Viewer"}`,
			expectedSA: &serviceaccounts.ServiceAccountDTO{
				Name:       "test",
				OrgId:      1,
				IsDisabled: false,
				Role:       string(org.RoleViewer),
			},
			expectedCode: http.StatusCreated,
		},
		{
			desc:         "should not be able to create service account without permission",
			basicRole:    org.RoleViewer,
			permissions:  []accesscontrol.Permission{{}},
			body:         `{"name": "test", "isDisabled": false, "role": "Viewer"}`,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should not be able to create service account with role that has higher privilege than caller",
			basicRole:    org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}},
			body:         `{"name": "test", "isDisabled": false, "role": "Editor"}`,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should not be able to create service account with invalid role",
			basicRole:    org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}},
			body:         `{"name": "test", "isDisabled": false, "role": "random"}`,
			expectedCode: http.StatusBadRequest,
		},
		{
			desc:         "should not be able to create service account with missing name",
			basicRole:    org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}},
			body:         `{"name": "", "isDisabled": false, "role": "Viewer"}`,
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &fakeService{ExpectedServiceAccount: tt.expectedSA, ExpectedErr: tt.expectedErr}
			})
			req := server.NewRequest(http.MethodPost, "/api/serviceaccounts/", strings.NewReader(tt.body))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgRole: tt.basicRole, OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			defer res.Body.Close()

			assert.Equal(t, tt.expectedCode, res.StatusCode)
		})
	}
}

func TestServiceAccountsAPI_DeleteServiceAccount(t *testing.T) {
	type TestCase struct {
		desc         string
		id           int64
		permissions  []accesscontrol.Permission
		expectedCode int
	}

	tests := []TestCase{
		{
			desc:         "should be able to delete service account with correct permission",
			id:           1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not ba able to delete with wrong permission",
			id:           2,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t)
			req := server.NewRequest(http.MethodDelete, fmt.Sprintf("/api/serviceaccounts/%d", tt.id), nil)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}})
			res, err := server.Send(req)
			require.NoError(t, err)
			defer res.Body.Close()

			assert.Equal(t, tt.expectedCode, res.StatusCode)
		})
	}
}

func TestServiceAccountsAPI_RetrieveServiceAccount(t *testing.T) {
	type TestCase struct {
		desc         string
		id           int64
		permissions  []accesscontrol.Permission
		expectedCode int
		expectedErr  error
		expectedSA   *serviceaccounts.ServiceAccountProfileDTO
	}

	tests := []TestCase{
		{
			desc:         "should be able to get service account with correct permission",
			id:           1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}},
			expectedSA:   &serviceaccounts.ServiceAccountProfileDTO{},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not ba able to get service account with wrong permission",
			id:           2,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &fakeService{ExpectedServiceAccountProfile: tt.expectedSA}
			})
			req := server.NewGetRequest(fmt.Sprintf("/api/serviceaccounts/%d", tt.id))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}})
			res, err := server.Send(req)
			require.NoError(t, err)
			defer res.Body.Close()

			assert.Equal(t, tt.expectedCode, res.StatusCode)
		})
	}
}

func setupTests(t *testing.T, opts ...func(a *ServiceAccountsAPI)) *webtest.Server {
	t.Helper()
	cfg := setting.NewCfg()
	api := &ServiceAccountsAPI{
		cfg:                  cfg,
		service:              &fakeService{},
		accesscontrolService: &actest.FakeService{},
		accesscontrol:        acimpl.ProvideAccessControl(cfg),
		RouterRegister:       routing.NewRouteRegister(),
		log:                  log.NewNopLogger(),
		permissionService:    &actest.FakePermissionsService{},
	}

	for _, o := range opts {
		o(api)
	}
	api.RegisterAPIEndpoints()
	return webtest.NewServer(t, api.RouterRegister)
}

var (
	serviceAccountPath   = "/api/serviceaccounts/"
	serviceAccountIDPath = serviceAccountPath + "%v"
)

// TODO:
// refactor this set of tests to make use of fakes for the ServiceAccountService
// all of the API tests are calling with all of the db store injections
// which is not ideal
// this is a bit of a hack to get the tests to pass until we refactor the tests
// to use fakes as in the user service tests

func serviceAccountRequestScenario(t *testing.T, httpMethod string, endpoint string, user *tests.TestUser, fn func(httpmethod string, endpoint string, user *tests.TestUser)) {
	t.Helper()
	fn(httpMethod, endpoint, user)
}

func setupTestServer(
	t *testing.T,
	svc *tests.ServiceAccountMock,
	routerRegister routing.RouteRegister,
	acmock *accesscontrolmock.Mock,
	sqlStore db.DB,
) (*web.Mux, *ServiceAccountsAPI) {
	cfg := setting.NewCfg()
	teamSvc := teamimpl.ProvideService(sqlStore, cfg)
	orgSvc, err := orgimpl.ProvideService(sqlStore, cfg, quotatest.New(false, nil))
	require.NoError(t, err)

	userSvc, err := userimpl.ProvideService(sqlStore, orgSvc, cfg, teamimpl.ProvideService(sqlStore, cfg), nil, quotatest.New(false, nil))
	require.NoError(t, err)

	// TODO: create fake for retriever to pass into the permissionservice
	retrieverSvc := retriever.ProvideService(sqlStore, nil, nil, nil, nil)
	saPermissionService, err := ossaccesscontrol.ProvideServiceAccountPermissions(
		cfg, routing.NewRouteRegister(), sqlStore, acmock, &licensing.OSSLicensingService{}, retrieverSvc, acmock, teamSvc, userSvc)
	require.NoError(t, err)
	acService := actest.FakeService{}

	a := NewServiceAccountsAPI(cfg, svc, acmock, acService, routerRegister, saPermissionService)
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

func newString(s string) *string {
	return &s
}

func TestServiceAccountsAPI_UpdateServiceAccount(t *testing.T) {
	store := db.InitTestDB(t)
	services := setupTestServices(t, store)

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
			server, saAPI := setupTestServer(t, &services.SAService, routing.NewRouteRegister(), tc.acmock, store)
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
				sa, err := saAPI.service.RetrieveServiceAccount(context.Background(), 1, int64(scopeID))
				require.NoError(t, err)
				require.Equal(t, *tc.body.Name, sa.Name)
				require.Equal(t, string(*tc.body.Role), sa.Role)
			}
		})
	}
}

type services struct {
	OrgService    org.Service
	UserService   user.Service
	SAService     tests.ServiceAccountMock
	APIKeyService apikey.Service
}

func setupTestServices(t *testing.T, db *sqlstore.SQLStore) services {
	kvStore := kvstore.ProvideService(db)
	quotaService := quotatest.New(false, nil)
	apiKeyService, err := apikeyimpl.ProvideService(db, db.Cfg, quotaService)
	require.NoError(t, err)

	orgService, err := orgimpl.ProvideService(db, setting.NewCfg(), quotaService)
	require.NoError(t, err)
	userSvc, err := userimpl.ProvideService(db, orgService, db.Cfg, nil, nil, quotaService)
	require.NoError(t, err)

	saStore := database.ProvideServiceAccountsStore(nil, db, apiKeyService, kvStore, userSvc, orgService)
	svcmock := tests.ServiceAccountMock{Store: saStore, Calls: tests.Calls{}, Stats: nil, SecretScanEnabled: false}

	return services{
		OrgService:    orgService,
		UserService:   userSvc,
		SAService:     svcmock,
		APIKeyService: apiKeyService,
	}
}

var _ service = new(fakeService)

type fakeService struct {
	service
	ExpectedErr                   error
	ExpectedServiceAccountTokens  []apikey.APIKey
	ExpectedServiceAccount        *serviceaccounts.ServiceAccountDTO
	ExpectedServiceAccountProfile *serviceaccounts.ServiceAccountProfileDTO
}

func (f *fakeService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	return f.ExpectedServiceAccount, f.ExpectedErr
}

func (f *fakeService) DeleteServiceAccount(ctx context.Context, orgID, id int64) error {
	return f.ExpectedErr
}

func (f *fakeService) RetrieveServiceAccount(ctx context.Context, orgID, id int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return f.ExpectedServiceAccountProfile, f.ExpectedErr
}

func (f *fakeService) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	return f.ExpectedServiceAccountTokens, f.ExpectedErr
}

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	satests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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
				a.service = &satests.FakeServiceAccountService{ExpectedServiceAccount: tt.expectedSA, ExpectedErr: tt.expectedErr}
			})
			req := server.NewRequest(http.MethodPost, "/api/serviceaccounts/", strings.NewReader(tt.body))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				OrgRole: tt.basicRole, OrgID: 1, IsAnonymous: true,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
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
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.Send(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestServiceAccountsAPI_RetrieveServiceAccount(t *testing.T) {
	type TestCase struct {
		desc         string
		id           int64
		permissions  []accesscontrol.Permission
		expectedCode int
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
				a.service = &satests.FakeServiceAccountService{ExpectedServiceAccountProfile: tt.expectedSA}
			})
			req := server.NewGetRequest(fmt.Sprintf("/api/serviceaccounts/%d", tt.id))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.Send(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestServiceAccountsAPI_UpdateServiceAccount(t *testing.T) {
	type TestCase struct {
		desc         string
		id           int64
		body         string
		basicRole    org.RoleType
		permissions  []accesscontrol.Permission
		expectedSA   *serviceaccounts.ServiceAccountProfileDTO
		expectedCode int
	}

	tests := []TestCase{
		{
			desc:         "should be able to update service account with correct permission",
			id:           1,
			body:         `{"role": "Editor"}`,
			basicRole:    org.RoleAdmin,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedSA:   &serviceaccounts.ServiceAccountProfileDTO{},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to update service account with wrong permission",
			id:           2,
			body:         `{}`,
			basicRole:    org.RoleAdmin,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should not be able to update service account with a role that has higher privilege then caller",
			id:           1,
			body:         `{"role": "Admin"}`,
			basicRole:    org.RoleEditor,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should not be able to update service account with invalid role",
			id:           1,
			body:         `{"role": "fake"}`,
			basicRole:    org.RoleEditor,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &satests.FakeServiceAccountService{ExpectedServiceAccountProfile: tt.expectedSA}
			})

			req := server.NewRequest(http.MethodPatch, fmt.Sprintf("/api/serviceaccounts/%d", tt.id), strings.NewReader(tt.body))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgRole: tt.basicRole, OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestServiceAccountsAPI_MigrateApiKeysToServiceAccounts(t *testing.T) {
	type TestCase struct {
		desc                    string
		orgId                   int64
		basicRole               org.RoleType
		permissions             []accesscontrol.Permission
		expectedMigrationResult *serviceaccounts.MigrationResult
		expectedCode            int
	}

	tests := []TestCase{
		{
			desc:      "should be able to migrate API keys to service accounts with correct permissions",
			orgId:     1,
			basicRole: org.RoleAdmin,
			permissions: []accesscontrol.Permission{
				{Action: serviceaccounts.ActionCreate, Scope: serviceaccounts.ScopeAll},
			},
			expectedMigrationResult: &serviceaccounts.MigrationResult{
				Total:         5,
				Migrated:      4,
				Failed:        1,
				FailedDetails: []string{"API key name: failedKey - Error: migration error"},
			},
			expectedCode: http.StatusOK,
		},
		{
			desc:      "should not be able to migrate API keys to service accounts with wrong permissions",
			orgId:     2,
			basicRole: org.RoleAdmin,
			permissions: []accesscontrol.Permission{
				{Action: serviceaccounts.ActionCreate, Scope: serviceaccounts.ScopeAll},
			},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &satests.FakeServiceAccountService{ExpectedMigrationResult: tt.expectedMigrationResult}
			})

			req := server.NewRequest(http.MethodPost, "/api/serviceaccounts/migrate", nil)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgRole: tt.basicRole, OrgID: tt.orgId, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
			if tt.expectedCode == http.StatusOK {
				var result serviceaccounts.MigrationResult
				err := json.NewDecoder(res.Body).Decode(&result)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedMigrationResult, &result)
			}
			require.NoError(t, res.Body.Close())
		})
	}
}

func setupTests(t *testing.T, opts ...func(a *ServiceAccountsAPI)) *webtest.Server {
	t.Helper()
	cfg := setting.NewCfg()
	api := &ServiceAccountsAPI{
		cfg:                  cfg,
		service:              &satests.FakeServiceAccountService{},
		accesscontrolService: &actest.FakeService{},
		accesscontrol:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient()),
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

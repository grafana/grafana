package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
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
		identityType claims.IdentityType
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
		{
			desc:         "access policy should be able to create admin service account with org.users:write",
			identityType: claims.TypeAccessPolicy,
			permissions: []accesscontrol.Permission{
				{Action: serviceaccounts.ActionCreate},
				{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:id:*"},
			},
			body:         `{"name": "test", "isDisabled": false, "role": "Admin"}`,
			expectedSA:   &serviceaccounts.ServiceAccountDTO{Name: "test", OrgId: 1, Role: string(org.RoleAdmin)},
			expectedCode: http.StatusCreated,
		},
		{
			desc:         "access policy should not be able to create service account with a role without org.users:write",
			identityType: claims.TypeAccessPolicy,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}},
			body:         `{"name": "test", "isDisabled": false, "role": "Viewer"}`,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "access policy should be able to create service account without a role",
			identityType: claims.TypeAccessPolicy,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionCreate}},
			body:         `{"name": "test", "isDisabled": false}`,
			expectedSA:   &serviceaccounts.ServiceAccountDTO{Name: "test", OrgId: 1},
			expectedCode: http.StatusCreated,
		},
		{
			desc:      "user with org.users:write should not be able to create service account above their role",
			basicRole: org.RoleViewer,
			permissions: []accesscontrol.Permission{
				{Action: serviceaccounts.ActionCreate},
				{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:*"},
			},
			body:         `{"name": "test", "isDisabled": false, "role": "Admin"}`,
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &satests.FakeServiceAccountService{ExpectedServiceAccount: tt.expectedSA, ExpectedErr: tt.expectedErr}
			})
			req := server.NewRequest(http.MethodPost, "/api/serviceaccounts/", strings.NewReader(tt.body))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				OrgRole: tt.basicRole, OrgID: 1, IsAnonymous: tt.identityType == "", FallbackType: tt.identityType,
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
		expectedErr  error
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
		{
			desc:         "should return a 404 error if the service account doesn't exist",
			id:           1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionDelete, Scope: "serviceaccounts:id:1"}},
			expectedErr:  serviceaccounts.ErrServiceAccountNotFound.Errorf("service account with id 1 not found"),
			expectedCode: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &satests.FakeServiceAccountService{ExpectedErr: tt.expectedErr}
			})

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
		identityType claims.IdentityType
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
		{
			desc:         "access policy should be able to update service account to admin with org.users:write",
			id:           1,
			body:         `{"role": "Admin"}`,
			identityType: claims.TypeAccessPolicy,
			permissions: []accesscontrol.Permission{
				{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:*"},
				{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:id:*"},
			},
			expectedSA:   &serviceaccounts.ServiceAccountProfileDTO{},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "access policy should not be able to update service account role without org.users:write",
			id:           1,
			body:         `{"role": "Editor"}`,
			identityType: claims.TypeAccessPolicy,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:*"}},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &satests.FakeServiceAccountService{ExpectedServiceAccountProfile: tt.expectedSA}
			})

			req := server.NewRequest(http.MethodPatch, fmt.Sprintf("/api/serviceaccounts/%d", tt.id), strings.NewReader(tt.body))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgRole: tt.basicRole, OrgID: 1, FallbackType: tt.identityType, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
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
		accesscontrol:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
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

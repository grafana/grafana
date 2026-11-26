package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPIEndpoint_GetCurrentOrg(t *testing.T) {
	type testCase struct {
		desc         string
		expectedCode int
		permission   []accesscontrol.Permission
	}

	tests := []testCase{
		{
			desc:         "should be able to view current org with correct permission",
			expectedCode: http.StatusOK,
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsRead}},
		},
		{
			desc:         "should not be able to view current org without correct permission",
			expectedCode: http.StatusForbidden,
			permission:   []accesscontrol.Permission{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			})

			req := webtest.RequestWithSignedInUser(server.NewGetRequest("/api/org/"), userWithPermissions(1, tt.permission))
			res, err := server.Send(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_UpdateOrg(t *testing.T) {
	type testCase struct {
		desc         string
		path         string
		body         string
		targetOrgID  int64
		permission   []accesscontrol.Permission
		expectedCode int
	}

	tests := []testCase{
		{
			desc:         "should be able to update current org with correct permissions",
			path:         "/api/org",
			body:         `{"name": "test"}`,
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsWrite}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to update current org without correct permissions",
			path:         "/api/org",
			body:         `{"name": "test"}`,
			permission:   []accesscontrol.Permission{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should be able to update address of current org with correct permissions",
			path:         "/api/org/address",
			body:         `{}`,
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsWrite}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to update address of current org without correct permissions",
			path:         "/api/org/address",
			body:         `{}`,
			permission:   []accesscontrol.Permission{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should be able to update target org with correct permissions",
			path:         "/api/orgs/1",
			body:         `{"name": "test"}`,
			targetOrgID:  1,
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsWrite}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to update target org without correct permissions",
			path:         "/api/orgs/2",
			targetOrgID:  2,
			body:         `{"name": "test"}`,
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsWrite}},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should be able to update address of target org with correct permissions",
			path:         "/api/orgs/1/address",
			body:         `{}`,
			targetOrgID:  1,
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsWrite}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to update address of target org without correct permissions",
			path:         "/api/orgs/2/address",
			body:         `{}`,
			targetOrgID:  2,
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsWrite}},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
				hs.userService = &usertest.FakeUserService{
					ExpectedSignedInUser: &user.SignedInUser{OrgID: tt.targetOrgID},
				}
				hs.accesscontrolService = actest.FakeService{}
				hs.authnService = &authntest.FakeService{
					ExpectedIdentity: &authn.Identity{
						OrgID: tt.targetOrgID,
					},
				}
			})

			req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, tt.path, strings.NewReader(tt.body)), userWithPermissions(1, tt.permission))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_CreateOrgs(t *testing.T) {
	type testCase struct {
		desc         string
		permission   []accesscontrol.Permission
		expectedCode int
	}

	tests := []testCase{
		{
			desc:         "should be able to create org with correct permission",
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsCreate}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to create org without correct permission",
			permission:   []accesscontrol.Permission{},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
				hs.accesscontrolService = actest.FakeService{}
				hs.userService = &usertest.FakeUserService{
					ExpectedSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 0},
				}
			})

			req := webtest.RequestWithSignedInUser(server.NewPostRequest("/api/orgs", strings.NewReader(`{"name": "test"}`)), authedUserWithPermissions(1, 0, tt.permission))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_DeleteOrgs(t *testing.T) {
	type testCase struct {
		desc         string
		permission   []accesscontrol.Permission
		expectedCode int
	}

	tests := []testCase{
		{
			desc:         "should be able to delete org with correct permission",
			permission:   []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsDelete}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to delete org without correct permission",
			permission:   []accesscontrol.Permission{},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			expectedIdentity := &authn.Identity{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permission),
				},
			}

			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
				hs.orgDeletionService = &orgtest.FakeOrgDeletionService{}
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: &user.SignedInUser{OrgID: 1}}
				hs.accesscontrolService = actest.FakeService{ExpectedPermissions: tt.permission}
				hs.authnService = &authntest.FakeService{}
				hs.authnService = &authntest.FakeService{
					ExpectedIdentity: expectedIdentity,
				}
			})

			req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodDelete, "/api/orgs/1", nil), userWithPermissions(2, nil))
			res, err := server.Send(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_DeleteOrgWithInvalidID(t *testing.T) {
	admin := authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsDelete}})
	admin.Permissions[accesscontrol.GlobalOrgID] = admin.GetPermissions()
	dashboardService := dashboards.NewFakeDashboardService(t)
	dashboardService.On("DeleteAllDashboards", mock.Anything, int64(-9999)).Return(nil).Maybe()
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.AccessControl = acimpl.ProvideAccessControl(hs.Features)
		hs.authnService = &authntest.FakeService{
			ExpectedIdentities: []*authn.Identity{
				{OrgID: accesscontrol.NoOrgID},
				{OrgID: accesscontrol.GlobalOrgID, Permissions: admin.Permissions},
			},
			ExpectedErrs: []error{nil, nil},
		}
		deletionService, err := orgimpl.ProvideDeletionService(nil, hs.Cfg, dashboardService, hs.AccessControl, apiserver.WithoutRestConfig)
		require.NoError(t, err)
		hs.orgDeletionService = deletionService
	})
	server.Mux.UseMiddleware(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(identity.WithRequester(r.Context(), admin)))
		})
	})

	req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodDelete, "/api/orgs/-9999", nil), admin)
	res, err := server.Send(req)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, res.Body.Close()) })

	var body map[string]string
	require.NoError(t, json.NewDecoder(res.Body).Decode(&body))
	assert.Equal(t, http.StatusNotFound, res.StatusCode, body["message"])
	assert.Equal(t, "Failed to delete organization. ID not found", body["message"])
	dashboardService.AssertNotCalled(t, "DeleteAllDashboards", mock.Anything, mock.Anything)
}

func TestAPIEndpoint_GetOrg(t *testing.T) {
	type testCase struct {
		desc         string
		permissions  []accesscontrol.Permission
		expectedCode int
	}

	tests := []testCase{
		{
			desc:         "should be able to fetch org with correct permissions",
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsRead}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to fetch org without correct permissions",
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			expectedIdentity := &authn.Identity{
				ID:    "1",
				Type:  claims.TypeUser,
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					0: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions),
					1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions),
				},
			}

			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: &user.SignedInUser{OrgID: 1}}
				hs.accesscontrolService = &actest.FakeService{ExpectedPermissions: tt.permissions}
				hs.authnService = &authntest.FakeService{
					ExpectedIdentity: expectedIdentity,
				}
			})
			verify := func(path string) {
				req := webtest.RequestWithSignedInUser(server.NewGetRequest(path), authedUserWithPermissions(1, 1, tt.permissions))
				res, err := server.Send(req)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedCode, res.StatusCode)
				if tt.expectedCode != res.StatusCode {
					t.Log("Failed on path", path)
				}
				require.NoError(t, res.Body.Close())
			}
			// search orgs
			verify("/api/orgs")
			// fetch by id
			verify("/api/orgs/1")
			// fetch by name
			verify("/api/orgs/name/test")
		})
	}
}

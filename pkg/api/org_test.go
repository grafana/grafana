package api

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPIEndpoint_GetCurrentOrg_LegacyAccessControl(t *testing.T) {
	type testCase struct {
		desc         string
		user         *user.SignedInUser
		expectedCode int
	}

	tests := []testCase{
		{
			desc:         "viewer can view current org",
			user:         &user.SignedInUser{OrgID: 1, OrgRole: org.RoleViewer},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "unauthenticated request cannot view current org",
			expectedCode: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			})

			req := server.NewGetRequest("/api/org/")
			if tt.user != nil {
				req = webtest.RequestWithSignedInUser(req, tt.user)
			}

			res, err := server.Send(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_GetCurrentOrg_RBAC(t *testing.T) {
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

func TestAPIEndpoint_UpdateOrg_LegacyAccessControl(t *testing.T) {
	type testCase struct {
		desc           string
		path           string
		body           string
		role           org.RoleType
		isGrafanaAdmin bool
		expectedCode   int
	}

	tests := []testCase{
		{
			desc:         "viewer cannot update current org",
			path:         "/api/org",
			body:         `{"name": "test"}`,
			role:         org.RoleViewer,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "editor cannot update current org",
			path:         "/api/org",
			body:         `{"name": "test"}`,
			role:         org.RoleEditor,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "admin can update current org",
			path:         "/api/org",
			body:         `{"name": "test"}`,
			role:         org.RoleAdmin,
			expectedCode: http.StatusOK,
		},
		{
			desc:         "viewer cannot update address of current org",
			path:         "/api/org/address",
			body:         `{}`,
			role:         org.RoleViewer,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "editor cannot update address of current org",
			path:         "/api/org/address",
			body:         `{}`,
			role:         org.RoleEditor,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "admin can update address of current org",
			path:         "/api/org/address",
			body:         `{}`,
			role:         org.RoleAdmin,
			expectedCode: http.StatusOK,
		},
		{
			desc:         "viewer cannot update target org",
			path:         "/api/orgs/1",
			body:         `{}`,
			role:         org.RoleViewer,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "editor cannot update target org",
			path:         "/api/orgs/1",
			body:         `{}`,
			role:         org.RoleEditor,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "admin cannot update target org",
			path:         "/api/orgs/1",
			body:         `{}`,
			role:         org.RoleAdmin,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:           "grafana admin can update target org",
			path:           "/api/orgs/1",
			body:           `{"name": "test"}`,
			role:           org.RoleAdmin,
			isGrafanaAdmin: true,
			expectedCode:   http.StatusOK,
		},
		{
			desc:         "viewer cannot update address of target org",
			path:         "/api/orgs/1/address",
			body:         `{}`,
			role:         org.RoleViewer,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "editor cannot update address of target org",
			path:         "/api/orgs/1/address",
			body:         `{}`,
			role:         org.RoleEditor,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "admin cannot update address of target org",
			path:         "/api/orgs/1/address",
			body:         `{}`,
			role:         org.RoleAdmin,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:           "grafana admin can update address of target org",
			path:           "/api/orgs/1/address",
			body:           `{}`,
			role:           org.RoleAdmin,
			isGrafanaAdmin: true,
			expectedCode:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			})

			req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, tt.path, strings.NewReader(tt.body)), &user.SignedInUser{
				OrgID:          1,
				OrgRole:        tt.role,
				IsGrafanaAdmin: tt.isGrafanaAdmin,
			})
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_UpdateOrg_RBAC(t *testing.T) {
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
			})

			req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, tt.path, strings.NewReader(tt.body)), userWithPermissions(1, tt.permission))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_CreateOrgs_LegacyAccessControl(t *testing.T) {
	type testCase struct {
		desc            string
		role            org.RoleType
		isGrafanaAdmin  bool
		anyoneCanCreate bool
		expectedCode    int
	}

	tests := []testCase{
		{
			desc:         "viewer cannot create org",
			role:         org.RoleViewer,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "editor cannot create org",
			role:         org.RoleEditor,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "admin cannot create org",
			role:         org.RoleAdmin,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:           "grafana admin can create org",
			role:           org.RoleViewer,
			isGrafanaAdmin: true,
			expectedCode:   http.StatusOK,
		},
		{
			desc:            "viewer can create org when AllowUserOrgCreate is set to true",
			role:            org.RoleViewer,
			isGrafanaAdmin:  true,
			anyoneCanCreate: true,
			expectedCode:    http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			})

			prev := setting.AllowUserOrgCreate
			defer func() {
				setting.AllowUserOrgCreate = prev
			}()
			setting.AllowUserOrgCreate = tt.anyoneCanCreate

			req := webtest.RequestWithSignedInUser(server.NewPostRequest("/api/orgs", strings.NewReader(`{"name": "test"}`)), &user.SignedInUser{
				OrgID:          1,
				OrgRole:        tt.role,
				IsGrafanaAdmin: tt.isGrafanaAdmin,
			})
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_CreateOrgs_RBAC(t *testing.T) {
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
					ExpectedSignedInUser: &user.SignedInUser{OrgID: 0},
				}
			})

			req := webtest.RequestWithSignedInUser(server.NewPostRequest("/api/orgs", strings.NewReader(`{"name": "test"}`)), userWithPermissions(0, tt.permission))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_DeleteOrgs_LegacyAccessControl2(t *testing.T) {
	type testCase struct {
		desc           string
		role           org.RoleType
		isGrafanaAdmin bool
		expectedCode   int
	}

	tests := []testCase{
		{
			desc:         "viewer cannot delete org",
			role:         org.RoleViewer,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "editor cannot delete org",
			role:         org.RoleEditor,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "admin cannot delete org",
			role:         org.RoleAdmin,
			expectedCode: http.StatusForbidden,
		},
		{
			desc:           "grafana admin can delete org",
			role:           org.RoleViewer,
			isGrafanaAdmin: true,
			expectedCode:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			})

			req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodDelete, "/api/orgs/1", nil), &user.SignedInUser{
				OrgID:          2,
				OrgRole:        tt.role,
				IsGrafanaAdmin: tt.isGrafanaAdmin,
			})
			res, err := server.Send(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_DeleteOrgs_RBAC(t *testing.T) {
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
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: &user.SignedInUser{OrgID: 1}}
				hs.accesscontrolService = actest.FakeService{ExpectedPermissions: tt.permission}
			})

			req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodDelete, "/api/orgs/1", nil), userWithPermissions(2, nil))
			res, err := server.Send(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAPIEndpoint_GetOrg_LegacyAccessControl(t *testing.T) {
	type testCase struct {
		desc           string
		role           org.RoleType
		isGrafanaAdmin bool
		expectedCode   int
	}

	tests := []testCase{
		{
			desc:           "should not be able to fetch org as viewer",
			role:           org.RoleViewer,
			isGrafanaAdmin: false,
			expectedCode:   http.StatusForbidden,
		},
		{
			desc:           "should not be able to fetch org as editor",
			role:           org.RoleEditor,
			isGrafanaAdmin: false,
			expectedCode:   http.StatusForbidden,
		},
		{
			desc:           "should not be able to search org as amin",
			role:           org.RoleAdmin,
			isGrafanaAdmin: false,
			expectedCode:   http.StatusForbidden,
		},
		{
			desc:           "should be able to fetch org as grafana admin",
			role:           org.RoleViewer,
			isGrafanaAdmin: true,
			expectedCode:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			})

			verify := func(path string) {
				req := webtest.RequestWithSignedInUser(server.NewGetRequest(path), &user.SignedInUser{
					OrgID:          1,
					OrgRole:        tt.role,
					IsGrafanaAdmin: tt.isGrafanaAdmin,
				})
				res, err := server.Send(req)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedCode, res.StatusCode)
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

func TestAPIEndpoint_GetOrg_RBAC(t *testing.T) {
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
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: &user.SignedInUser{OrgID: 0}}
				hs.accesscontrolService = &actest.FakeService{ExpectedPermissions: tt.permissions}
			})
			verify := func(path string) {
				req := webtest.RequestWithSignedInUser(server.NewGetRequest(path), userWithPermissions(2, nil))
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

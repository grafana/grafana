package api

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/org"
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

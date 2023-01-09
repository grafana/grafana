package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

var (
	searchOrgsURL    = "/api/orgs/"
	getOrgsURL       = "/api/orgs/%v"
	getOrgsByNameURL = "/api/orgs/name/%v"

	deleteOrgsURL = "/api/orgs/%v"

	createOrgsURL    = "/api/orgs/"
	testCreateOrgCmd = `{ "name": "TestOrg%v"}`
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

// setupOrgsDBForAccessControlTests creates orgs up until orgID and fake user as member of org
func setupOrgsDBForAccessControlTests(t *testing.T, db *sqlstore.SQLStore, c accessControlScenarioContext, orgID int64) {
	t.Helper()
	setInitCtxSignedInViewer(c.initCtx)
	u := *c.initCtx.SignedInUser
	u.OrgID = orgID
	c.userService.(*usertest.FakeUserService).ExpectedSignedInUser = &u

	// Create `orgsCount` orgs
	for i := 1; i <= int(orgID); i++ {
		_, err := c.hs.orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: fmt.Sprintf("TestOrg%v", i), UserID: 0})
		require.NoError(t, err)
	}
}

func TestAPIEndpoint_CreateOrgs_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	setting.AllowUserOrgCreate = false
	input := strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 2))
	t.Run("Viewer cannot create Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	input = strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 3))
	t.Run("Grafana Admin viewer can create Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = false
	setting.AllowUserOrgCreate = true
	input = strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 4))
	t.Run("User viewer can create Orgs when AllowUserOrgCreate setting is true", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_CreateOrgs_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 0)

	input := strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 2))
	t.Run("AccessControl allows creating Orgs with correct permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsCreate}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 3))
	t.Run("AccessControl prevents creating Orgs with incorrect permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_DeleteOrgs_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("Viewer cannot delete Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana Admin viewer can delete Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_DeleteOrgs_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("AccessControl prevents deleting Orgs with incorrect permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, 2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents deleting Orgs with correct permissions in another org", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsDelete}}, 1)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl allows deleting Orgs with correct permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsDelete}}, 2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_SearchOrgs_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	t.Run("Viewer cannot list Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana Admin viewer can list Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_SearchOrgs_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)

	t.Run("AccessControl allows listing Orgs with correct permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsRead}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents listing Orgs with correct permissions not granted globally", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsRead}}, 1)
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents listing Orgs with incorrect permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_GetOrg_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("Viewer cannot view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana admin viewer can view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_GetOrg_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("AccessControl allows viewing another org with correct permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsRead}}, 2)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing another org with correct permissions in another org", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsRead}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents viewing another org with incorrect permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, 2)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_GetOrgByName_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("Viewer cannot view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana admin viewer can view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_GetOrgByName_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("AccessControl allows viewing another org with correct permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsRead}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing another org with incorrect permissions", func(t *testing.T) {
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

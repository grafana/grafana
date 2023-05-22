package resourcepermissions

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type getDescriptionTestCase struct {
	desc           string
	options        Options
	permissions    []accesscontrol.Permission
	expected       Description
	expectedStatus int
}

func TestApi_getDescription(t *testing.T) {
	tests := []getDescriptionTestCase{
		{
			desc: "should return description",
			options: Options{
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				Assignments: Assignments{
					Users:        true,
					Teams:        true,
					BuiltInRoles: true,
				},
				PermissionsToActions: map[string][]string{
					"View":  {"dashboards:read"},
					"Edit":  {"dashboards:read", "dashboards:write", "dashboards:delete"},
					"Admin": {"dashboards:read", "dashboards:write", "dashboards:delete", "dashboards.permissions:read", "dashboards:permissions:write"},
				},
			},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read"},
			},
			expected: Description{
				Assignments: Assignments{
					Users:        true,
					Teams:        true,
					BuiltInRoles: true,
				},
				Permissions: []string{"View", "Edit", "Admin"},
			},
			expectedStatus: http.StatusOK,
		},
		{
			desc: "should only return user assignment",
			options: Options{
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				Assignments: Assignments{
					Users:        true,
					Teams:        false,
					BuiltInRoles: false,
				},
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
				},
			},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read"},
			},
			expected: Description{
				Assignments: Assignments{
					Users:        true,
					Teams:        false,
					BuiltInRoles: false,
				},
				Permissions: []string{"View"},
			},
			expectedStatus: http.StatusOK,
		},
		{
			desc: "should return 403 when missing read permission",
			options: Options{
				Resource:          "dashboards",
				ResourceAttribute: "uid",
				Assignments: Assignments{
					Users:        true,
					Teams:        false,
					BuiltInRoles: false,
				},
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
				},
			},
			permissions:    []accesscontrol.Permission{},
			expected:       Description{},
			expectedStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, _, _ := setupTestEnvironment(t, tt.permissions, tt.options)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1}, service)

			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/access-control/%s/description", tt.options.Resource), nil)
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, req)

			got := Description{}
			require.NoError(t, json.NewDecoder(recorder.Body).Decode(&got))
			assert.Equal(t, tt.expected, got)
			if tt.expectedStatus == http.StatusOK {
				assert.Equal(t, tt.expectedStatus, recorder.Code)
			}
		})
	}
}

type getPermissionsTestCase struct {
	desc           string
	resourceID     string
	permissions    []accesscontrol.Permission
	expectedStatus int
}

func TestApi_getPermissions(t *testing.T) {
	tests := []getPermissionsTestCase{
		{
			desc:       "expect permissions for resource with id 1",
			resourceID: "1",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
			expectedStatus: 200,
		},
		{
			desc:           "expect http status 403 when missing permission",
			resourceID:     "1",
			permissions:    []accesscontrol.Permission{},
			expectedStatus: 403,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, sql, _ := setupTestEnvironment(t, tt.permissions, testOptions)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}}, service)

			seedPermissions(t, tt.resourceID, sql, service)

			permissions, recorder := getPermission(t, server, testOptions.Resource, tt.resourceID)
			assert.Equal(t, tt.expectedStatus, recorder.Code)

			if tt.expectedStatus == http.StatusOK {
				checkSeededPermissions(t, permissions)
			}
		})
	}
}

type setBuiltinPermissionTestCase struct {
	desc           string
	resourceID     string
	builtInRole    string
	expectedStatus int
	permission     string
	permissions    []accesscontrol.Permission
}

func TestApi_setBuiltinRolePermission(t *testing.T) {
	tests := []setBuiltinPermissionTestCase{
		{
			desc:           "should set Edit permission for Viewer",
			resourceID:     "1",
			builtInRole:    "Viewer",
			expectedStatus: 200,
			permission:     "Edit",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
		},
		{
			desc:           "should set View permission for Admin",
			resourceID:     "1",
			builtInRole:    "Admin",
			expectedStatus: 200,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
		},
		{
			desc:           "should return http 400 for invalid built in role",
			resourceID:     "1",
			builtInRole:    "Invalid",
			expectedStatus: http.StatusBadRequest,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
			},
		},
		{
			desc:           "should set return http 403 when missing permissions",
			resourceID:     "1",
			builtInRole:    "Invalid",
			expectedStatus: http.StatusForbidden,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, _, _ := setupTestEnvironment(t, tt.permissions, testOptions)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}}, service)

			recorder := setPermission(t, server, testOptions.Resource, tt.resourceID, tt.permission, "builtInRoles", tt.builtInRole)
			assert.Equal(t, tt.expectedStatus, recorder.Code)

			if tt.expectedStatus == http.StatusOK {
				permissions, _ := getPermission(t, server, testOptions.Resource, tt.resourceID)
				require.Len(t, permissions, 1)
				assert.Equal(t, tt.permission, permissions[0].Permission)
				assert.Equal(t, tt.builtInRole, permissions[0].BuiltInRole)
			}
		})
	}
}

type setTeamPermissionTestCase struct {
	desc           string
	teamID         int64
	resourceID     string
	expectedStatus int
	permission     string
	permissions    []accesscontrol.Permission
}

func TestApi_setTeamPermission(t *testing.T) {
	tests := []setTeamPermissionTestCase{
		{
			desc:           "should set Edit permission for team 1",
			teamID:         1,
			resourceID:     "1",
			expectedStatus: 200,
			permission:     "Edit",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
		},
		{
			desc:           "should set View permission for team 1",
			teamID:         1,
			resourceID:     "1",
			expectedStatus: 200,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
		},
		{
			desc:           "should set return http 400 when team does not exist",
			teamID:         2,
			resourceID:     "1",
			expectedStatus: http.StatusBadRequest,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
			},
		},
		{
			desc:           "should set return http 403 when missing permissions",
			teamID:         2,
			resourceID:     "1",
			expectedStatus: http.StatusForbidden,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, _, teamSvc := setupTestEnvironment(t, tt.permissions, testOptions)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}}, service)

			// seed team
			_, err := teamSvc.CreateTeam("test", "test@test.com", 1)
			require.NoError(t, err)

			recorder := setPermission(t, server, testOptions.Resource, tt.resourceID, tt.permission, "teams", strconv.Itoa(int(tt.teamID)))
			assert.Equal(t, tt.expectedStatus, recorder.Code)

			assert.Equal(t, tt.expectedStatus, recorder.Code)
			if tt.expectedStatus == http.StatusOK {
				permissions, _ := getPermission(t, server, testOptions.Resource, tt.resourceID)
				require.Len(t, permissions, 1)
				assert.Equal(t, tt.permission, permissions[0].Permission)
				assert.Equal(t, tt.teamID, permissions[0].TeamID)
			}
		})
	}
}

type setUserPermissionTestCase struct {
	desc           string
	userID         int64
	resourceID     string
	expectedStatus int
	permission     string
	permissions    []accesscontrol.Permission
}

func TestApi_setUserPermission(t *testing.T) {
	tests := []setUserPermissionTestCase{
		{
			desc:           "should set Edit permission for user 1",
			userID:         1,
			resourceID:     "1",
			expectedStatus: 200,
			permission:     "Edit",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
		},
		{
			desc:           "should set View permission for user 1",
			userID:         1,
			resourceID:     "1",
			expectedStatus: 200,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
		},
		{
			desc:           "should set return http 400 when user does not exist",
			userID:         2,
			resourceID:     "1",
			expectedStatus: http.StatusBadRequest,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
			},
		},
		{
			desc:           "should set return http 403 when missing permissions",
			userID:         2,
			resourceID:     "1",
			expectedStatus: http.StatusForbidden,
			permission:     "View",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, sql, _ := setupTestEnvironment(t, tt.permissions, testOptions)
			server := setupTestServer(t, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)},
			}, service)

			// seed user
			orgSvc, err := orgimpl.ProvideService(sql, sql.Cfg, quotatest.New(false, nil))
			require.NoError(t, err)
			usrSvc, err := userimpl.ProvideService(sql, orgSvc, sql.Cfg, nil, nil, &quotatest.FakeQuotaService{}, supportbundlestest.NewFakeBundleService())
			require.NoError(t, err)
			_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)

			recorder := setPermission(t, server, testOptions.Resource, tt.resourceID, tt.permission, "users", strconv.Itoa(int(tt.userID)))
			assert.Equal(t, tt.expectedStatus, recorder.Code)

			assert.Equal(t, tt.expectedStatus, recorder.Code)
			if tt.expectedStatus == http.StatusOK {
				permissions, _ := getPermission(t, server, testOptions.Resource, tt.resourceID)
				require.Len(t, permissions, 1)
				assert.Equal(t, tt.permission, permissions[0].Permission)
				assert.Equal(t, tt.userID, permissions[0].UserID)
			}
		})
	}
}

func setupTestServer(t *testing.T, user *user.SignedInUser, service *Service) *web.Mux {
	server := web.New()
	server.UseMiddleware(web.Renderer(path.Join(setting.StaticRootPath, "views"), "[[", "]]"))
	server.Use(contextProvider(&testContext{user}))
	service.api.router.Register(server)
	return server
}

type testContext struct {
	user *user.SignedInUser
}

func contextProvider(tc *testContext) web.Handler {
	return func(c *web.Context) {
		signedIn := tc.user != nil
		reqCtx := &contextmodel.ReqContext{
			Context:      c,
			SignedInUser: tc.user,
			IsSignedIn:   signedIn,
			SkipCache:    true,
			Logger:       log.New("test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), reqCtx))
	}
}

var testOptions = Options{
	Resource:          "dashboards",
	ResourceAttribute: "id",
	Assignments: Assignments{
		Users:        true,
		Teams:        true,
		BuiltInRoles: true,
	},
	PermissionsToActions: map[string][]string{
		"View": {"dashboards:read"},
		"Edit": {"dashboards:read", "dashboards:write", "dashboards:delete"},
	},
}

func getPermission(t *testing.T, server *web.Mux, resource, resourceID string) ([]resourcePermissionDTO, *httptest.ResponseRecorder) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/access-control/%s/%s", resource, resourceID), nil)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, req)

	var permissions []resourcePermissionDTO
	if recorder.Code == http.StatusOK {
		require.NoError(t, json.NewDecoder(recorder.Body).Decode(&permissions))
	}
	return permissions, recorder
}

func setPermission(t *testing.T, server *web.Mux, resource, resourceID, permission, assignment, assignTo string) *httptest.ResponseRecorder {
	body := strings.NewReader(fmt.Sprintf(`{"permission": "%s"}`, permission))
	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/access-control/%s/%s/%s/%s", resource, resourceID, assignment, assignTo), body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, req)

	return recorder
}

func checkSeededPermissions(t *testing.T, permissions []resourcePermissionDTO) {
	assert.Len(t, permissions, 3, "expected three assignments: user, team, builtin")
	for _, p := range permissions {
		if p.UserID != 0 {
			assert.Equal(t, "View", p.Permission)
		} else if p.TeamID != 0 {
			assert.Equal(t, "Edit", p.Permission)
		} else {
			assert.Equal(t, "Edit", p.Permission)
		}
	}
}

func seedPermissions(t *testing.T, resourceID string, sql *sqlstore.SQLStore, service *Service) {
	t.Helper()
	// seed team 1 with "Edit" permission on dashboard 1
	teamSvc := teamimpl.ProvideService(sql, sql.Cfg)
	team, err := teamSvc.CreateTeam("test", "test@test.com", 1)
	require.NoError(t, err)
	_, err = service.SetTeamPermission(context.Background(), team.OrgID, team.ID, resourceID, "Edit")
	require.NoError(t, err)
	// seed user 1 with "View" permission on dashboard 1
	orgSvc, err := orgimpl.ProvideService(sql, sql.Cfg, quotatest.New(false, nil))
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(sql, orgSvc, sql.Cfg, nil, nil, &quotatest.FakeQuotaService{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)
	u, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
	require.NoError(t, err)
	_, err = service.SetUserPermission(context.Background(), u.OrgID, accesscontrol.User{ID: u.ID}, resourceID, "View")
	require.NoError(t, err)
	// seed built in role Admin with "Edit" permission on dashboard 1
	_, err = service.SetBuiltInRolePermission(context.Background(), 1, "Admin", resourceID, "Edit")
	require.NoError(t, err)
}

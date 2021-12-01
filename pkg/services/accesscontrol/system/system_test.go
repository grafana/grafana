package system

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type getDescriptionTestCase struct {
	desc           string
	options        Options
	permissions    []*accesscontrol.Permission
	expected       Description
	expectedStatus int
}

func TestSystem_getDescription(t *testing.T) {
	tests := []getDescriptionTestCase{
		{
			desc: "should return description",
			options: Options{
				Resource: "dashboards",
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
			permissions: []*accesscontrol.Permission{
				{Action: "dashboards.permissions:read"},
			},
			expected: Description{
				Assignments: Assignments{
					Users:        true,
					Teams:        true,
					BuiltInRoles: true,
				},
				Permissions: []string{"Admin", "Edit", "View"},
			},
			expectedStatus: http.StatusOK,
		},
		{
			desc: "should only return user assignment",
			options: Options{
				Resource: "dashboards",
				Assignments: Assignments{
					Users:        true,
					Teams:        false,
					BuiltInRoles: false,
				},
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
				},
			},
			permissions: []*accesscontrol.Permission{
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
				Resource: "dashboards",
				Assignments: Assignments{
					Users:        true,
					Teams:        false,
					BuiltInRoles: false,
				},
				PermissionsToActions: map[string][]string{
					"View": {"dashboards:read"},
				},
			},
			permissions:    []*accesscontrol.Permission{},
			expected:       Description{},
			expectedStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			_, server, _ := setupTestEnvironment(t, &models.SignedInUser{}, tt.permissions, tt.options)
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/access-control/system/%s/description", tt.options.Resource), nil)
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
	permissions    []*accesscontrol.Permission
	expectedStatus int
}

func TestSystem_getPermissions(t *testing.T) {
	tests := []getPermissionsTestCase{
		{
			desc:           "expect permissions for resource with id 1",
			resourceID:     "1",
			permissions:    []*accesscontrol.Permission{{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"}},
			expectedStatus: 200,
		},
		{
			desc:           "expect http status 403 when missing permission",
			resourceID:     "1",
			permissions:    []*accesscontrol.Permission{},
			expectedStatus: 403,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {

			options := Options{
				Resource: "dashboards",
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

			system, server, sql := setupTestEnvironment(t, &models.SignedInUser{OrgId: 1}, tt.permissions, options)

			// seed team 1 with "Edit" permission on dashboard 1
			team, err := sql.CreateTeam("test", "test@test.com", 1)
			require.NoError(t, err)
			_, err = system.manager.SetTeamPermission(context.Background(), team.OrgId, team.Id, tt.resourceID, []string{"dashboards:read", "dashboards:write", "dashboards:delete"})
			require.NoError(t, err)
			// seed user 1 with "View" permission on dashboard 1
			u, err := sql.CreateUser(context.Background(), models.CreateUserCommand{Login: "test", OrgId: 1})
			_, err = system.manager.SetUserPermission(context.Background(), u.OrgId, u.Id, tt.resourceID, []string{"dashboards:read"})
			require.NoError(t, err)

			// seed built in role Admin with "View" permission on dashboard 1
			_, err = system.manager.SetBuiltinRolePermission(context.Background(), 1, "Admin", tt.resourceID, []string{"dashboards:read", "dashboards:write", "dashboards:delete"})
			require.NoError(t, err)

			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/access-control/system/%s/%s", options.Resource, tt.resourceID), nil)
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, req)

			assert.Equal(t, tt.expectedStatus, recorder.Code)
			if tt.expectedStatus == http.StatusOK {
				var permissions []resourcePermissionDTO
				require.NoError(t, json.NewDecoder(recorder.Body).Decode(&permissions))
				assert.Len(t, permissions, 3)
				for _, p := range permissions {
					if p.UserId != 0 {
						assert.Equal(t, "View", p.Permission)
					} else if p.TeamId != 0 {
						assert.Equal(t, "Edit", p.Permission)
					} else {
						assert.Equal(t, "Edit", p.Permission)
					}
				}

			}

		})
	}
}

func TestSystem_setBuiltinRolePermission(t *testing.T) {
}

func TestSystem_setTeamPermission(t *testing.T) {
}

func TestSystem_setUserPermission(t *testing.T) {
}

func setupTestEnvironment(t *testing.T, user *models.SignedInUser, permissions []*accesscontrol.Permission, ops Options) (*System, *web.Mux, *sqlstore.SQLStore) {
	sql := sqlstore.InitTestDB(t)
	store := database.ProvideService(sql)

	system, err := NewSystem(ops, routing.NewRouteRegister(), accesscontrolmock.New().WithPermissions(permissions), store)
	require.NoError(t, err)

	server := web.New()
	server.UseMiddleware(web.Renderer(path.Join(setting.StaticRootPath, "views"), "[[", "]]"))
	server.Use(contextProvider(&testContext{user}))
	system.router.Register(server)

	return system, server, sql
}

type testContext struct {
	user *models.SignedInUser
}

func contextProvider(tc *testContext) web.Handler {
	return func(c *web.Context) {
		signedIn := tc.user != nil
		reqCtx := &models.ReqContext{
			Context:      c,
			SignedInUser: tc.user,
			IsSignedIn:   signedIn,
			SkipCache:    true,
			Logger:       log.New("test"),
		}
		c.Map(reqCtx)
	}
}

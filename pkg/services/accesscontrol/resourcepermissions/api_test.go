package resourcepermissions

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

type getDescriptionTestCase struct {
	desc           string
	options        Options
	permissions    []accesscontrol.Permission
	expected       Description
	expectedStatus int
}

func TestIntegrationApi_getDescription(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, _, _ := setupTestEnvironment(t, tt.options)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}}, service)

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

func TestIntegrationApi_getDescription_K8sFormat(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []getDescriptionTestCase{
		{
			desc: "should return description with k8s action format",
			options: Options{
				Resource:          "testresources",
				ResourceAttribute: "uid",
				APIGroup:          "test.grafana.app",
				K8sActionFormat:   true,
				Assignments: Assignments{
					Users:        true,
					Teams:        true,
					BuiltInRoles: true,
				},
				PermissionsToActions: map[string][]string{
					"View": {"test.grafana.app/testresources:get"},
					"Edit": {"test.grafana.app/testresources:get", "test.grafana.app/testresources:update"},
				},
			},
			permissions: []accesscontrol.Permission{
				{Action: "test.grafana.app/testresources:get_permissions"},
			},
			expected: Description{
				Assignments: Assignments{
					Users:        true,
					Teams:        true,
					BuiltInRoles: true,
				},
				Permissions: []string{"View", "Edit"},
			},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, _, _ := setupTestEnvironment(t, tt.options)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}}, service)

			// Verify endpoint still works at legacy URL
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/access-control/%s/description", tt.options.Resource), nil)
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, req)

			got := Description{}
			require.NoError(t, json.NewDecoder(recorder.Body).Decode(&got))
			assert.Equal(t, tt.expected, got)
			assert.Equal(t, tt.expectedStatus, recorder.Code)
		})
	}
}

type getPermissionsTestCase struct {
	desc           string
	resourceID     string
	permissions    []accesscontrol.Permission
	expectedStatus int
}

func TestIntegrationApi_getPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, usrSvc, teamSvc := setupTestEnvironment(t, testOptions)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}}, service)

			seedPermissions(t, tt.resourceID, usrSvc, teamSvc, service)

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

func TestIntegrationApi_setBuiltinRolePermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, _, _ := setupTestEnvironment(t, testOptions)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}}, service)

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
	byUID          bool
}

func TestIntegrationApi_setTeamPermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
		{
			desc:           "should set View permission for team with id 1 but through UID",
			teamID:         1,
			resourceID:     "1",
			expectedStatus: 200,
			permission:     "View",
			byUID:          true,
			permissions: []accesscontrol.Permission{
				{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
				{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
				{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
				{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, _, teamSvc := setupTestEnvironment(t, testOptions)
			server := setupTestServer(t, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}}, service)

			// seed team
			teamCmd := team.CreateTeamCommand{
				Name:  "test",
				Email: "test@test.com",
				OrgID: 1,
			}
			team, err := teamSvc.CreateTeam(context.Background(), &teamCmd)
			require.NoError(t, err)

			assignTo := strconv.Itoa(int(tt.teamID))
			if tt.byUID {
				if team.ID == tt.teamID {
					assignTo = team.UID
				}
			}
			recorder := setPermission(t, server, testOptions.Resource, tt.resourceID, tt.permission, "teams", assignTo)
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

func TestIntegrationApi_setUserPermission(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			service, usrSvc, _ := setupTestEnvironment(t, testOptions)
			server := setupTestServer(t, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)},
			}, service)

			_, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)

			recorder := setPermission(t, server, testOptions.Resource, tt.resourceID, tt.permission, "users", strconv.Itoa(int(tt.userID)))
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

func TestIntegrationApi_setUserPermissionForTeams(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type setUserPermissionForTeamsTestCase struct {
		setUserPermissionTestCase
		teamCmd *team.CreateTeamCommand
	}
	tests := []setUserPermissionForTeamsTestCase{
		{
			setUserPermissionTestCase: setUserPermissionTestCase{
				desc:           "should set Member permission for user 1",
				userID:         1,
				expectedStatus: 200,
				permission:     "Member",
				permissions: []accesscontrol.Permission{
					{Action: "teams.permissions:read", Scope: accesscontrol.ScopeTeamsAll},
					{Action: "teams.permissions:write", Scope: accesscontrol.ScopeTeamsAll},
					{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
				},
			},
			teamCmd: &team.CreateTeamCommand{
				Name:  "test",
				Email: "test@test.com",
				OrgID: 1,
			},
		},
		{
			setUserPermissionTestCase: setUserPermissionTestCase{
				desc:           "should set Admin permission for user 1",
				userID:         1,
				expectedStatus: 200,
				permission:     "Admin",
				permissions: []accesscontrol.Permission{
					{Action: "teams.permissions:read", Scope: accesscontrol.ScopeTeamsAll},
					{Action: "teams.permissions:write", Scope: accesscontrol.ScopeTeamsAll},
					{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
				},
			},
			teamCmd: &team.CreateTeamCommand{
				Name:  "test",
				Email: "test@test.com",
				OrgID: 1,
			},
		},
		{
			setUserPermissionTestCase: setUserPermissionTestCase{
				desc:           "should return status 400 for a provisioned team",
				userID:         1,
				expectedStatus: 400,
				permission:     "Member",
				permissions: []accesscontrol.Permission{
					{Action: "teams.permissions:read", Scope: accesscontrol.ScopeTeamsAll},
					{Action: "teams.permissions:write", Scope: accesscontrol.ScopeTeamsAll},
					{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
				},
			},
			teamCmd: &team.CreateTeamCommand{
				Name:          "test",
				Email:         "test@test.com",
				OrgID:         1,
				IsProvisioned: true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			service, usrSvc, teamSvc := setupTestEnvironment(t, testOptionsForTeams)
			server := setupTestServer(t, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)},
			}, service)

			_, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)

			expectedTeam, err := teamSvc.CreateTeam(context.Background(), tt.teamCmd)
			require.NoError(t, err)

			resourceID := strconv.Itoa(int(expectedTeam.ID))

			recorder := setPermission(t, server, testOptionsForTeams.Resource, resourceID, tt.permission, "users", strconv.Itoa(int(tt.userID)))
			assert.Equal(t, tt.expectedStatus, recorder.Code)

			if tt.expectedStatus == http.StatusOK {
				permissions, _ := getPermission(t, server, testOptionsForTeams.Resource, resourceID)
				require.Len(t, permissions, 1)
				assert.Equal(t, tt.permission, permissions[0].Permission)
				assert.Equal(t, tt.userID, permissions[0].UserID)
			}
		})
	}
}

// Verifies the ResourcePermission redirect falls back to legacy only in Mode0-3. With no rest
// config the K8s write fails, so Mode0-3 falls back (200) and Mode4/5 returns the error (500).
func TestIntegrationApi_setUserPermission_dualWriterModeFallback(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name           string
		mode           grafanarest.DualWriterMode
		expectedStatus int
	}{
		{name: "Mode3 falls back to legacy", mode: grafanarest.Mode3, expectedStatus: http.StatusOK},
		{name: "Mode5 does not fall back", mode: grafanarest.Mode5, expectedStatus: http.StatusInternalServerError},
	}

	perms := []accesscontrol.Permission{
		{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
		{Action: "dashboards.permissions:write", Scope: "dashboards:id:1"},
		{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setOpenFeatureFlags(t, map[string]bool{
				featuremgmt.FlagKubernetesAuthZResourcePermissionsRedirect: true,
				featuremgmt.FlagKubernetesAuthzResourcePermissionApis:      true,
			})

			service, usrSvc, _, cfg, _ := setupTestEnvironmentWithCfg(t, testOptions, featuremgmt.WithFeatures())
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.ResourcePermissionInfo.GroupResource().String(): {DualWriterMode: tt.mode},
			}

			server := setupTestServer(t, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), perms)},
			}, service)

			createdUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)

			recorder := setPermission(t, server, testOptions.Resource, "1", "Edit", "users", strconv.Itoa(int(createdUser.ID)))
			assert.Equal(t, tt.expectedStatus, recorder.Code)

			if tt.expectedStatus == http.StatusOK {
				permissions, _ := getPermission(t, server, testOptions.Resource, "1")
				require.Len(t, permissions, 1)
				assert.Equal(t, "Edit", permissions[0].Permission)
				assert.Equal(t, createdUser.ID, permissions[0].UserID)
			}
		})
	}
}

// Verifies the ResourcePermission redirect read falls back to legacy only in Mode0-3. With no rest
// config the K8s read fails, so Mode0-3 falls back to seeded legacy permissions (200) and Mode4/5
// returns the error (500).
func TestIntegrationApi_getPermissions_dualWriterModeFallback(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name           string
		mode           grafanarest.DualWriterMode
		expectedStatus int
	}{
		{name: "Mode3 falls back to legacy", mode: grafanarest.Mode3, expectedStatus: http.StatusOK},
		{name: "Mode5 does not fall back", mode: grafanarest.Mode5, expectedStatus: http.StatusInternalServerError},
	}

	perms := []accesscontrol.Permission{
		{Action: "dashboards.permissions:read", Scope: "dashboards:id:1"},
		{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
		{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setOpenFeatureFlags(t, map[string]bool{
				featuremgmt.FlagKubernetesAuthZResourcePermissionsRedirect: true,
				featuremgmt.FlagKubernetesAuthzResourcePermissionApis:      true,
			})

			service, usrSvc, teamSvc, cfg, _ := setupTestEnvironmentWithCfg(t, testOptions, featuremgmt.WithFeatures())
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.ResourcePermissionInfo.GroupResource().String(): {DualWriterMode: tt.mode},
			}

			server := setupTestServer(t, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), perms)},
			}, service)

			seedPermissions(t, "1", usrSvc, teamSvc, service)

			permissions, recorder := getPermission(t, server, testOptions.Resource, "1")
			assert.Equal(t, tt.expectedStatus, recorder.Code)

			if tt.expectedStatus == http.StatusOK {
				checkSeededPermissions(t, permissions)
			}
		})
	}
}

// Verifies the team-members write falls back to legacy only in Mode0-3. With no rest config
// the K8s write fails, so Mode0-3 falls back (200) and Mode4/5 returns the error (500).
func TestIntegrationApi_setUserPermissionForTeams_dualWriterModeFallback(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	tests := []struct {
		name           string
		mode           grafanarest.DualWriterMode
		expectedStatus int
	}{
		{name: "Mode3 falls back to legacy", mode: grafanarest.Mode3, expectedStatus: http.StatusOK},
		{name: "Mode5 does not fall back", mode: grafanarest.Mode5, expectedStatus: http.StatusInternalServerError},
	}

	perms := []accesscontrol.Permission{
		{Action: "teams.permissions:read", Scope: accesscontrol.ScopeTeamsAll},
		{Action: "teams.permissions:write", Scope: accesscontrol.ScopeTeamsAll},
		{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// The teams redirect is gated on the kubernetesTeamsRedirect toggle.
			setOpenFeatureFlag(t, featuremgmt.FlagKubernetesTeamsRedirect, true)

			service, usrSvc, teamSvc, cfg, _ := setupTestEnvironmentWithCfg(t, testOptionsForTeams, featuremgmt.WithFeatures())
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.TeamResourceInfo.GroupResource().String(): {DualWriterMode: tt.mode},
			}

			server := setupTestServer(t, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), perms)},
			}, service)

			createdUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)
			createdTeam, err := teamSvc.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "test", Email: "test@test.com", OrgID: 1})
			require.NoError(t, err)

			recorder := setPermission(t, server, testOptionsForTeams.Resource, strconv.Itoa(int(createdTeam.ID)), "Member", "users", strconv.Itoa(int(createdUser.ID)))
			assert.Equal(t, tt.expectedStatus, recorder.Code)
		})
	}
}

// Verifies a team-member removal returns 200 only when the K8s teams redirect actually removed
// the member (dual-write mode leaves the legacy row already gone), and 404 when the member was
// never there - whether the redirect is off or a working redirect no-ops on an absent member.
func TestIntegrationApi_setUserPermissionForTeams_removeMemberDualWrite(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	perms := []accesscontrol.Permission{
		{Action: "teams.permissions:read", Scope: accesscontrol.ScopeTeamsAll},
		{Action: "teams.permissions:write", Scope: accesscontrol.ScopeTeamsAll},
		{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll},
	}

	tests := []struct {
		name string
		// redirectHasRestConfig points the redirect at a working K8s stub; without it the redirect
		// fails and the legacy fallback is the only remover.
		redirectHasRestConfig bool
		// memberInRedirectSpec lists the member in the stub's Team, so the redirect actually removes
		// it. When false the redirect no-ops (the member wasn't there).
		memberInRedirectSpec bool
		expectedStatus       int
	}{
		{name: "redirect removed the member -> 200, not 500", redirectHasRestConfig: true, memberInRedirectSpec: true, expectedStatus: http.StatusOK},
		{name: "redirect no-ops on absent member -> 404, not 200", redirectHasRestConfig: true, memberInRedirectSpec: false, expectedStatus: http.StatusNotFound},
		{name: "no redirect, member genuinely absent -> 404, not 500", redirectHasRestConfig: false, expectedStatus: http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setOpenFeatureFlag(t, featuremgmt.FlagKubernetesTeamsRedirect, true)

			// Wire the production OnSetUser hook so a removal actually runs RemoveTeamMemberHook.
			// dbHelper is resolved once the test database exists (below) and read
			// at request time by the hook for qualified table names.
			var dbHelper *legacysql.LegacyDatabaseHelper
			opts := testOptionsForTeams
			opts.OnSetUser = func(session *db.Session, orgID int64, usr accesscontrol.User, resourceID, permission string) error {
				teamID, err := strconv.ParseInt(resourceID, 10, 64)
				if err != nil {
					return err
				}
				if permission == "" {
					return teamimpl.RemoveTeamMemberHook(dbHelper, session, &team.RemoveTeamMemberCommand{OrgID: orgID, UserID: usr.ID, TeamID: teamID})
				}
				return teamimpl.AddOrUpdateTeamMemberHook(dbHelper, session, usr.ID, orgID, teamID, usr.IsExternal, team.PermissionTypeMember)
			}

			// memberUID is filled in once the user exists; the K8s stub reads it at request time.
			var memberUID string
			if tt.redirectHasRestConfig {
				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// The stub Team lists the member only when the case wants the redirect to remove it.
					var members []iamv0.TeamTeamMember
					if tt.memberInRedirectSpec {
						members = []iamv0.TeamTeamMember{{Kind: subjectKindUser, Name: memberUID, Permission: iamv0.TeamTeamPermissionMember}}
					}
					teamObj := iamv0.Team{
						TypeMeta:   metav1.TypeMeta{APIVersion: iamv0.TeamResourceInfo.GroupVersion().String(), Kind: "Team"},
						ObjectMeta: metav1.ObjectMeta{Name: "team", Namespace: "org-1", ResourceVersion: "1"},
						Spec:       iamv0.TeamSpec{Members: members},
					}
					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(teamObj)
				}))
				t.Cleanup(ts.Close)
				opts.RestConfigProvider = &mockDirectRestConfigProvider{restConfig: &clientrest.Config{Host: ts.URL}}
			}

			service, usrSvc, teamSvc, cfg, sqlDB := setupTestEnvironmentWithCfg(t, opts, featuremgmt.WithFeatures())
			dbHelper, err := legacysql.NewDatabaseProvider(sqlDB)(context.Background())
			require.NoError(t, err)
			// Mode1 is non-authoritative, so the request dual-writes and falls through to legacy.
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				iamv0.TeamResourceInfo.GroupResource().String(): {DualWriterMode: grafanarest.Mode1},
			}

			createdUser, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
			require.NoError(t, err)
			createdTeam, err := teamSvc.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "test", Email: "test@test.com", OrgID: 1})
			require.NoError(t, err)

			// Never add the member to the legacy store: emulates the redirect having already removed it.
			usr, err := usrSvc.GetByID(context.Background(), &user.GetUserByIDQuery{ID: createdUser.ID})
			require.NoError(t, err)
			memberUID = usr.UID

			server := setupTestServer(t, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), perms)},
			}, service)

			// permission "" removes the user from the team.
			recorder := setPermission(t, server, testOptionsForTeams.Resource, strconv.Itoa(int(createdTeam.ID)), "", "users", strconv.Itoa(int(createdUser.ID)))
			assert.Equal(t, tt.expectedStatus, recorder.Code)
		})
	}
}

// mockDirectRestConfigProvider returns a fixed rest config so tests can point the K8s redirect at
// an httptest server instead of a real apiserver.
type mockDirectRestConfigProvider struct {
	restConfig *clientrest.Config
}

func (m *mockDirectRestConfigProvider) GetDirectRestConfig(_ *contextmodel.ReqContext) *clientrest.Config {
	return m.restConfig
}

func (m *mockDirectRestConfigProvider) DirectlyServeHTTP(_ http.ResponseWriter, _ *http.Request) {}

func (m *mockDirectRestConfigProvider) IsReady() bool { return true }

var openFeatureTestMu sync.Mutex

// setOpenFeatureFlag sets the global OpenFeature provider so flag resolves to value for the test.
func setOpenFeatureFlag(t *testing.T, flag string, value bool) {
	t.Helper()
	setOpenFeatureFlags(t, map[string]bool{flag: value})
}

// setOpenFeatureFlags sets multiple flags on the global OpenFeature provider for the test.
func setOpenFeatureFlags(t *testing.T, flags map[string]bool) {
	t.Helper()
	openFeatureTestMu.Lock()

	flagMap := make(map[string]memprovider.InMemoryFlag, len(flags))
	for flag, value := range flags {
		flagMap[flag] = memprovider.InMemoryFlag{Key: flag, Variants: map[string]any{"": value}}
	}

	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(flagMap)
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openFeatureTestMu.Unlock()
	})
}

func setupTestServer(t *testing.T, user *user.SignedInUser, service *Service) *web.Mux {
	server := web.New()
	server.UseMiddleware(web.Renderer("views", "[[", "]]"))
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
			SkipDSCache:  true,
			Logger:       log.New("test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), reqCtx))
	}
}

var testOptions = Options{
	Resource:          "dashboards",
	APIGroup:          dashboardv1.APIGroup,
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

var testOptionsForTeams = Options{
	Resource:          "teams",
	ResourceAttribute: "id",
	Assignments: Assignments{
		Users: true,
	},
	PermissionsToActions: map[string][]string{
		"Member": {"teams:read"},
		"Admin":  {"teams:read", "teams:write", "teams:delete"},
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

func seedPermissions(t *testing.T, resourceID string, usrSvc user.Service, teamSvc team.Service, service *Service) {
	t.Helper()

	// seed team 1 with "Edit" permission on dashboard 1
	teamCmd := team.CreateTeamCommand{
		Name:  "test",
		Email: "test@test.com",
		OrgID: 1,
	}
	team, err := teamSvc.CreateTeam(context.Background(), &teamCmd)
	require.NoError(t, err)
	_, err = service.SetTeamPermission(context.Background(), team.OrgID, team.ID, resourceID, "Edit")
	require.NoError(t, err)
	// seed user 1 with "View" permission on dashboard 1
	u, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{Login: "test", OrgID: 1})
	require.NoError(t, err)
	_, err = service.SetUserPermission(context.Background(), u.OrgID, accesscontrol.User{ID: u.ID}, resourceID, "View")
	require.NoError(t, err)
	// seed built in role Admin with "Edit" permission on dashboard 1
	_, err = service.SetBuiltInRolePermission(context.Background(), 1, "Admin", resourceID, "Edit")
	require.NoError(t, err)
}

package resourcepermissions

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
)

type setUserResourcePermissionTest struct {
	desc              string
	orgID             int64
	userID            int64
	actions           []string
	resource          string
	resourceID        string
	resourceAttribute string
	seeds             []SetResourcePermissionCommand
}

func TestIntegrationStore_SetUserResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	tests := []setUserResourcePermissionTest{
		{
			desc:              "should set resource permission for user",
			userID:            1,
			actions:           []string{"datasources:query"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
		},
		{
			desc:              "should remove resource permission for user",
			orgID:             1,
			userID:            1,
			actions:           []string{},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
			seeds: []SetResourcePermissionCommand{
				{
					Actions:    []string{"datasources:query"},
					Resource:   "datasources",
					ResourceID: "1",
				},
			},
		},
		{
			desc:              "should add new resource permission for user",
			orgID:             1,
			userID:            1,
			actions:           []string{"datasources:query", "datasources:write"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
			seeds: []SetResourcePermissionCommand{
				{
					Actions:    []string{"datasources:write"},
					Resource:   "datasources",
					ResourceID: "1",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			store, _ := setupTestEnv(t)

			for _, s := range test.seeds {
				_, err := store.SetUserResourcePermission(context.Background(), test.orgID, accesscontrol.User{ID: test.userID}, s, nil)
				require.NoError(t, err)
			}

			added, err := store.SetUserResourcePermission(context.Background(), test.userID, accesscontrol.User{ID: test.userID}, SetResourcePermissionCommand{
				Actions:           test.actions,
				Resource:          test.resource,
				ResourceID:        test.resourceID,
				ResourceAttribute: test.resourceAttribute,
			}, nil)

			require.NoError(t, err)
			if len(test.actions) == 0 {
				assert.Equal(t, accesscontrol.ResourcePermission{}, *added)
			} else {
				assert.Len(t, added.Actions, len(test.actions))
				assert.Equal(t, accesscontrol.Scope(test.resource, test.resourceAttribute, test.resourceID), added.Scope)
			}
		})
	}
}

type setTeamResourcePermissionTest struct {
	desc              string
	orgID             int64
	teamID            int64
	actions           []string
	resource          string
	resourceID        string
	resourceAttribute string
	seeds             []SetResourcePermissionCommand
}

func TestIntegrationStore_SetTeamResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	tests := []setTeamResourcePermissionTest{
		{
			desc:              "should add new resource permission for team",
			orgID:             1,
			teamID:            1,
			actions:           []string{"datasources:query"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
		},
		{
			desc:              "should add new resource permission when others exist",
			orgID:             1,
			teamID:            1,
			actions:           []string{"datasources:query", "datasources:write"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
			seeds: []SetResourcePermissionCommand{
				{
					Actions:           []string{"datasources:query"},
					Resource:          "datasources",
					ResourceID:        "1",
					ResourceAttribute: "uid",
				},
			},
		},
		{
			desc:              "should remove permissions for team",
			orgID:             1,
			teamID:            1,
			actions:           []string{},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
			seeds: []SetResourcePermissionCommand{
				{
					Actions:           []string{"datasources:query"},
					Resource:          "datasources",
					ResourceID:        "1",
					ResourceAttribute: "uid",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			store, _ := setupTestEnv(t)

			for _, s := range test.seeds {
				_, err := store.SetTeamResourcePermission(context.Background(), test.orgID, test.teamID, s, nil)
				require.NoError(t, err)
			}

			added, err := store.SetTeamResourcePermission(context.Background(), test.orgID, test.teamID, SetResourcePermissionCommand{
				Actions:           test.actions,
				Resource:          test.resource,
				ResourceID:        test.resourceID,
				ResourceAttribute: test.resourceAttribute,
			}, nil)

			require.NoError(t, err)
			if len(test.actions) == 0 {
				assert.Equal(t, accesscontrol.ResourcePermission{}, *added)
			} else {
				assert.Len(t, added.Actions, len(test.actions))
				assert.Equal(t, accesscontrol.Scope(test.resource, test.resourceAttribute, test.resourceID), added.Scope)
			}
		})
	}
}

type setBuiltInResourcePermissionTest struct {
	desc              string
	orgID             int64
	builtInRole       string
	actions           []string
	resource          string
	resourceID        string
	resourceAttribute string
	seeds             []SetResourcePermissionCommand
}

func TestIntegrationStore_SetBuiltInResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	tests := []setBuiltInResourcePermissionTest{
		{
			desc:              "should add new resource permission for builtin role",
			orgID:             1,
			builtInRole:       "Viewer",
			actions:           []string{"datasources:query"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
		},
		{
			desc:              "should add new resource permission when others exist",
			orgID:             1,
			builtInRole:       "Viewer",
			actions:           []string{"datasources:query", "datasources:write"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
			seeds: []SetResourcePermissionCommand{
				{
					Actions:           []string{"datasources:query"},
					Resource:          "datasources",
					ResourceID:        "1",
					ResourceAttribute: "uid",
				},
			},
		},
		{
			desc:              "should remove permissions for builtin role",
			orgID:             1,
			builtInRole:       "Viewer",
			actions:           []string{},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
			seeds: []SetResourcePermissionCommand{
				{
					Actions:           []string{"datasources:query"},
					Resource:          "datasources",
					ResourceID:        "1",
					ResourceAttribute: "uid",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			store, _ := setupTestEnv(t)

			for _, s := range test.seeds {
				_, err := store.SetBuiltInResourcePermission(context.Background(), test.orgID, test.builtInRole, s, nil)
				require.NoError(t, err)
			}

			added, err := store.SetBuiltInResourcePermission(context.Background(), test.orgID, test.builtInRole, SetResourcePermissionCommand{
				Actions:           test.actions,
				Resource:          test.resource,
				ResourceID:        test.resourceID,
				ResourceAttribute: test.resourceAttribute,
			}, nil)

			require.NoError(t, err)
			if len(test.actions) == 0 {
				assert.Equal(t, accesscontrol.ResourcePermission{}, *added)
			} else {
				assert.Len(t, added.Actions, len(test.actions))
				assert.Equal(t, accesscontrol.Scope(test.resource, test.resourceAttribute, test.resourceID), added.Scope)
			}
		})
	}
}

type setResourcePermissionsTest struct {
	desc              string
	orgID             int64
	resourceAttribute string
	commands          []SetResourcePermissionsCommand
}

func TestIntegrationStore_SetResourcePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	tests := []setResourcePermissionsTest{
		{
			desc:              "should set all permissions provided",
			orgID:             1,
			resourceAttribute: "uid",
			commands: []SetResourcePermissionsCommand{
				{
					User: accesscontrol.User{ID: 1},
					SetResourcePermissionCommand: SetResourcePermissionCommand{
						Actions:           []string{"datasources:query"},
						Resource:          "datasources",
						ResourceID:        "1",
						ResourceAttribute: "uid",
					},
				},
				{
					TeamID: 3,
					SetResourcePermissionCommand: SetResourcePermissionCommand{
						Actions:           []string{"datasources:query"},
						Resource:          "datasources",
						ResourceID:        "1",
						ResourceAttribute: "uid",
					},
				},
				{
					BuiltinRole: "Admin",
					SetResourcePermissionCommand: SetResourcePermissionCommand{
						Actions:           []string{"datasources:query"},
						Resource:          "datasources",
						ResourceID:        "1",
						ResourceAttribute: "uid",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, _ := setupTestEnv(t)

			permissions, err := store.SetResourcePermissions(context.Background(), tt.orgID, tt.commands, ResourceHooks{})
			require.NoError(t, err)

			require.Len(t, permissions, len(tt.commands))
			for i, c := range tt.commands {
				if len(c.Actions) == 0 {
					assert.Equal(t, accesscontrol.ResourcePermission{}, permissions[i])
				} else {
					assert.Len(t, permissions[i].Actions, len(c.Actions))
					assert.Equal(t, c.TeamID, permissions[i].TeamId)
					assert.Equal(t, c.User.ID, permissions[i].UserId)
					assert.Equal(t, c.BuiltinRole, permissions[i].BuiltInRole)
					assert.Equal(t, accesscontrol.Scope(c.Resource, tt.resourceAttribute, c.ResourceID), permissions[i].Scope)
				}
			}
		})
	}
}

type getResourcePermissionsTest struct {
	desc        string
	user        *user.SignedInUser
	numUsers    int
	query       GetResourcePermissionsQuery
	expectedLen int
}

func TestIntegrationStore_GetResourcePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	tests := []getResourcePermissionsTest{
		{
			desc: "should return permissions for resource id",
			user: &user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}},
				}},
			numUsers: 3,
			query: GetResourcePermissionsQuery{
				Actions:              []string{"datasources:query"},
				Resource:             "datasources",
				ResourceID:           "1",
				ResourceAttribute:    "uid",
				EnforceAccessControl: true,
			},
			expectedLen: 4,
		},
		{
			desc: "should return manage permissions for all resource ids",
			user: &user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}},
				}},
			numUsers: 3,
			query: GetResourcePermissionsQuery{
				Actions:              []string{"datasources:query"},
				Resource:             "datasources",
				ResourceID:           "1",
				ResourceAttribute:    "uid",
				OnlyManaged:          true,
				EnforceAccessControl: true,
			},
			expectedLen: 3,
		},
		{
			desc: "should return users caller can read",
			user: &user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionOrgUsersRead: {"users:id:1", "users:id:3"}},
				}},
			numUsers: 3,
			query: GetResourcePermissionsQuery{
				Actions:              []string{"datasources:query"},
				Resource:             "datasources",
				ResourceID:           "1",
				ResourceAttribute:    "uid",
				OnlyManaged:          true,
				EnforceAccessControl: true,
			},
			expectedLen: 2,
		},
		{
			desc: "should return permissions for all users when access control is not enforces",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {}}},
			numUsers: 3,
			query: GetResourcePermissionsQuery{
				Actions:              []string{"datasources:query"},
				Resource:             "datasources",
				ResourceID:           "1",
				ResourceAttribute:    "uid",
				OnlyManaged:          true,
				EnforceAccessControl: false,
			},
			expectedLen: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, sql := setupTestEnv(t)
			orgService, err := orgimpl.ProvideService(sql, sql.Cfg, quotatest.New(false, nil))
			require.NoError(t, err)

			err = sql.WithDbSession(context.Background(), func(sess *db.Session) error {
				role := &accesscontrol.Role{
					OrgID:   tt.user.OrgID,
					UID:     "seeded",
					Name:    "seeded",
					Updated: time.Now(),
					Created: time.Now(),
				}
				_, err := sess.Insert(role)
				require.NoError(t, err)

				permission := &accesscontrol.Permission{
					RoleID:  role.ID,
					Action:  "datasources:query",
					Scope:   "datasources:*",
					Updated: time.Now(),
					Created: time.Now(),
				}
				_, err = sess.Insert(permission)
				require.NoError(t, err)

				builtInRole := &accesscontrol.BuiltinRole{
					RoleID:  role.ID,
					OrgID:   1,
					Role:    "Viewer",
					Updated: time.Now(),
					Created: time.Now(),
				}
				_, err = sess.Insert(builtInRole)
				require.NoError(t, err)

				return nil
			})
			require.NoError(t, err)

			seedResourcePermissions(t, store, sql, orgService, tt.query.Actions, tt.query.Resource, tt.query.ResourceID, tt.query.ResourceAttribute, tt.numUsers)

			tt.query.User = tt.user
			permissions, err := store.GetResourcePermissions(context.Background(), tt.user.OrgID, tt.query)
			require.NoError(t, err)
			assert.Len(t, permissions, tt.expectedLen)
		})
	}
}

func seedResourcePermissions(t *testing.T, store *store, sql *sqlstore.SQLStore, orgService org.Service, actions []string, resource, resourceID, resourceAttribute string, numUsers int) {
	t.Helper()
	var orgModel *org.Org
	usrSvc, err := userimpl.ProvideService(sql, orgService, sql.Cfg, nil, nil, quotatest.New(false, nil), &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	for i := 0; i < numUsers; i++ {
		if orgModel == nil {
			cmd := &org.CreateOrgCommand{Name: "test", UserID: int64(i)}
			addedOrg, err := orgService.CreateWithMember(context.Background(), cmd)
			require.NoError(t, err)
			orgModel = addedOrg
		}

		u, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
			Login: fmt.Sprintf("user:%s%d", resourceID, i),
			OrgID: orgModel.ID,
		})
		require.NoError(t, err)

		_, err = store.SetUserResourcePermission(context.Background(), 1, accesscontrol.User{ID: u.ID}, SetResourcePermissionCommand{
			Actions:           actions,
			Resource:          resource,
			ResourceID:        resourceID,
			ResourceAttribute: resourceAttribute,
		}, nil)
		require.NoError(t, err)
	}
}

func setupTestEnv(t testing.TB) (*store, *sqlstore.SQLStore) {
	sql := db.InitTestDB(t)
	return NewStore(sql), sql
}

func TestStore_IsInherited(t *testing.T) {
	type testCase struct {
		description   string
		permission    *flatResourcePermission
		requiredScope string
		expected      bool
	}

	testCases := []testCase{
		{
			description: "same scope is not inherited",
			permission: &flatResourcePermission{
				Scope:    dashboards.ScopeDashboardsProvider.GetResourceScopeUID("some_uid"),
				RoleName: fmt.Sprintf("%stest_role", accesscontrol.ManagedRolePrefix),
			},
			requiredScope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID("some_uid"),
			expected:      false,
		},
		{
			description: "specific folder scope for dashboards is inherited",
			permission: &flatResourcePermission{
				Scope:    dashboards.ScopeFoldersProvider.GetResourceScopeUID("parent"),
				RoleName: fmt.Sprintf("%stest_role", accesscontrol.ManagedRolePrefix),
			},
			requiredScope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID("some_uid"),
			expected:      true,
		},
		{
			description: "wildcard scope from a fixed role is not inherited",
			permission: &flatResourcePermission{
				Scope:    dashboards.ScopeDashboardsAll,
				RoleName: fmt.Sprintf("%sfixed_role", accesscontrol.FixedRolePrefix),
			},
			requiredScope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID("some_uid"),
			expected:      false,
		},
		{
			description: "parent folder scope for nested folders is inherited",
			permission: &flatResourcePermission{
				Scope:    dashboards.ScopeFoldersProvider.GetResourceScopeUID("parent"),
				RoleName: fmt.Sprintf("%stest_role", accesscontrol.ManagedRolePrefix),
			},
			requiredScope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("some_folder"),
			expected:      true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			isInherited := tc.permission.IsInherited(tc.requiredScope)
			assert.Equal(t, tc.expected, isInherited)
		})
	}
}

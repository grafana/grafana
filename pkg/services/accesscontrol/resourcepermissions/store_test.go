package resourcepermissions

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
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

func TestMain(m *testing.M) {
	testsuite.Run(m)
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
			store, _, _ := setupTestEnv(t)

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
			store, _, _ := setupTestEnv(t)

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
			store, _, _ := setupTestEnv(t)

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
			store, _, _ := setupTestEnv(t)

			permissions, err := store.SetResourcePermissions(context.Background(), tt.orgID, tt.commands, ResourceHooks{})
			require.NoError(t, err)

			require.Len(t, permissions, len(tt.commands))
			for i, c := range tt.commands {
				if len(c.Actions) == 0 {
					assert.Equal(t, accesscontrol.ResourcePermission{}, permissions[i])
				} else {
					assert.Len(t, permissions[i].Actions, len(c.Actions))
					assert.Equal(t, c.TeamID, permissions[i].TeamID)
					assert.Equal(t, c.User.ID, permissions[i].UserID)
					assert.Equal(t, c.BuiltinRole, permissions[i].BuiltInRole)
					assert.Equal(t, accesscontrol.Scope(c.Resource, tt.resourceAttribute, c.ResourceID), permissions[i].Scope)
				}
			}
		})
	}
}

type getResourcePermissionsTest struct {
	desc               string
	user               *user.SignedInUser
	numUsers           int
	numServiceAccounts int
	query              GetResourcePermissionsQuery
	expectedLen        int
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
				},
			},
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
				},
			},
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
				},
			},
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
			desc: "should return users and service accounts caller can read",
			user: &user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {
						accesscontrol.ActionOrgUsersRead: {"users:id:1", "users:id:2", "users:id:3"},
						serviceaccounts.ActionRead:       {"serviceaccounts:id:5"},
					},
				},
			},
			numUsers:           3,
			numServiceAccounts: 3,
			query: GetResourcePermissionsQuery{
				Actions:              []string{"datasources:query"},
				Resource:             "datasources",
				ResourceID:           "1",
				ResourceAttribute:    "uid",
				OnlyManaged:          true,
				EnforceAccessControl: true,
			},
			expectedLen: 4,
		},
		{
			desc: "should return permissions for all users when access control is not enforces",
			user: &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {}},
			},
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
			store, sql, settingsProvider := setupTestEnv(t)
			orgService, err := orgimpl.ProvideService(sql, settingsProvider, quotatest.New(false, nil))
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

			seedResourcePermissions(t, store, sql, settingsProvider, orgService, tt.query.Actions, tt.query.Resource, tt.query.ResourceID, tt.query.ResourceAttribute, tt.numUsers, tt.numServiceAccounts)

			tt.query.User = tt.user
			permissions, err := store.GetResourcePermissions(context.Background(), tt.user.OrgID, tt.query)
			require.NoError(t, err)
			assert.Len(t, permissions, tt.expectedLen)
		})
	}
}

func seedResourcePermissions(
	t *testing.T, store *store, sql db.DB, settingsProvider setting.SettingsProvider, orgService org.Service,
	actions []string, resource, resourceID, resourceAttribute string, numUsers, numServiceAccounts int,
) {
	t.Helper()

	orgID, err := orgService.GetOrCreate(context.Background(), "test")
	require.NoError(t, err)

	usrSvc, err := userimpl.ProvideService(
		sql, orgService, settingsProvider, nil, nil, tracing.InitializeTracerForTest(),
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	create := func(login string, isServiceAccount bool) {
		u, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
			Login:            login,
			IsServiceAccount: isServiceAccount,
			OrgID:            orgID,
		})

		require.NoError(t, err)

		_, err = store.SetUserResourcePermission(context.Background(), orgID, accesscontrol.User{ID: u.ID}, SetResourcePermissionCommand{
			Actions:           actions,
			Resource:          resource,
			ResourceID:        resourceID,
			ResourceAttribute: resourceAttribute,
		}, nil)
		require.NoError(t, err)
	}

	for i := 0; i < numUsers; i++ {
		create(fmt.Sprintf("user:%s:%d", resourceID, i), false)
	}

	for i := 0; i < numServiceAccounts; i++ {
		create(fmt.Sprintf("sa:%s:%d", resourceID, i), true)
	}
}

func setupTestEnv(t testing.TB) (*store, db.DB, setting.SettingsProvider) {
	sql, settingsProvider := db.InitTestDBWithCfg(t)
	return NewStore(settingsProvider, sql, featuremgmt.WithFeatures()), sql, settingsProvider
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

type orgPermission struct {
	OrgID  int64  `xorm:"org_id"`
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

func TestIntegrationStore_DeleteResourcePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type deleteResourcePermissionsTest struct {
		desc              string
		orgID             int64
		resourceAttribute string
		command           DeleteResourcePermissionsCmd
		shouldExist       []orgPermission
		shouldNotExist    []orgPermission
	}

	tests := []deleteResourcePermissionsTest{
		{
			desc:              "should delete all permissions for resource id in org 1",
			orgID:             1,
			resourceAttribute: "uid",
			command: DeleteResourcePermissionsCmd{
				Resource:          "datasources",
				ResourceID:        "1",
				ResourceAttribute: "uid",
			},
			shouldExist: []orgPermission{
				{
					OrgID:  2,
					Action: "datasources:query",
					Scope:  "datasources:uid:1",
				},
				{
					OrgID:  2,
					Action: "datasources:write",
					Scope:  "datasources:uid:1",
				},
				{
					OrgID:  1,
					Action: "datasources:query",
					Scope:  "datasources:uid:2",
				},
				{
					OrgID:  1,
					Action: "datasources:write",
					Scope:  "datasources:uid:2",
				},
			},
			shouldNotExist: []orgPermission{
				{
					OrgID:  1,
					Action: "datasources:query",
					Scope:  "datasources:uid:1",
				}, {
					OrgID:  1,
					Action: "datasources:write",
					Scope:  "datasources:uid:1",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store, _, _ := setupTestEnv(t)

			_, err := store.SetResourcePermissions(context.Background(), 1, []SetResourcePermissionsCommand{
				{
					User: accesscontrol.User{ID: 1},
					SetResourcePermissionCommand: SetResourcePermissionCommand{
						Actions:           []string{"datasources:query", "datasources:write"},
						Resource:          "datasources",
						ResourceID:        "1",
						ResourceAttribute: "uid",
					},
				},
			}, ResourceHooks{})
			require.NoError(t, err)

			_, err = store.SetResourcePermissions(context.Background(), 1, []SetResourcePermissionsCommand{
				{
					User: accesscontrol.User{ID: 1},
					SetResourcePermissionCommand: SetResourcePermissionCommand{
						Actions:           []string{"datasources:query", "datasources:write"},
						Resource:          "datasources",
						ResourceID:        "2",
						ResourceAttribute: "uid",
					},
				},
			}, ResourceHooks{})
			require.NoError(t, err)

			_, err = store.SetResourcePermissions(context.Background(), 2, []SetResourcePermissionsCommand{
				{
					User: accesscontrol.User{ID: 1},
					SetResourcePermissionCommand: SetResourcePermissionCommand{
						Actions:           []string{"datasources:query", "datasources:write"},
						Resource:          "datasources",
						ResourceID:        "1",
						ResourceAttribute: "uid",
					},
				},
			}, ResourceHooks{})
			require.NoError(t, err)

			err = store.DeleteResourcePermissions(context.Background(), tt.orgID, &tt.command)
			require.NoError(t, err)

			permissions := retrievePermissionsHelper(store, t)

			for _, p := range tt.shouldExist {
				assert.Contains(t, permissions, p)
			}

			for _, p := range tt.shouldNotExist {
				assert.NotContains(t, permissions, p)
			}
		})
	}
}

func retrievePermissionsHelper(store *store, t *testing.T) []orgPermission {
	permissions := []orgPermission{}
	err := store.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		err := sess.SQL(`
    SELECT permission.*, role.org_id
    FROM permission
    INNER JOIN role ON permission.role_id = role.id
`).Find(&permissions)
		require.NoError(t, err)
		return nil
	})

	require.NoError(t, err)
	return permissions
}

func TestStore_StoreActionSet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type actionSetTest struct {
		desc     string
		resource string
		action   string
		actions  []string
	}

	tests := []actionSetTest{
		{
			desc:     "should be able to store action set",
			resource: "folders",
			action:   "edit",
			actions:  []string{"folders:read", "folders:write"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			asService := NewInMemoryActionSetStore()
			asService.StoreActionSet(GetActionSetName(tt.resource, tt.action), tt.actions)

			actionSetName := GetActionSetName(tt.resource, tt.action)
			actionSet := asService.ResolveActionSet(actionSetName)
			require.Equal(t, tt.actions, actionSet)
		})
	}
}

func TestStore_ResolveActionSet(t *testing.T) {
	actionSetService := NewActionSetService()
	actionSetService.StoreActionSet("folders:edit", []string{"folders:read", "folders:write", "dashboards:read", "dashboards:write"})
	actionSetService.StoreActionSet("folders:view", []string{"folders:read", "dashboards:read"})
	actionSetService.StoreActionSet("dashboards:view", []string{"dashboards:read"})

	type actionSetTest struct {
		desc               string
		action             string
		expectedActionSets []string
	}

	tests := []actionSetTest{
		{
			desc:               "should return empty list for an action that is not a part of any action sets",
			action:             "datasources:query",
			expectedActionSets: []string{},
		},
		{
			desc:               "should be able to resolve one action set for the resource of the same type",
			action:             "folders:write",
			expectedActionSets: []string{"folders:edit"},
		},
		{
			desc:               "should be able to resolve multiple action sets for the resource of the same type",
			action:             "folders:read",
			expectedActionSets: []string{"folders:view", "folders:edit"},
		},
		{
			desc:               "should be able to resolve multiple action sets for the resource of a different type",
			action:             "dashboards:read",
			expectedActionSets: []string{"folders:view", "folders:edit", "dashboards:view"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			actionSets := actionSetService.ResolveAction(tt.action)
			require.ElementsMatch(t, tt.expectedActionSets, actionSets)
		})
	}
}

func TestStore_ExpandActions(t *testing.T) {
	actionSetService := NewActionSetService()
	actionSetService.StoreActionSet("folders:edit", []string{"folders:read", "folders:write", "dashboards:read", "dashboards:write"})
	actionSetService.StoreActionSet("folders:view", []string{"folders:read", "dashboards:read"})
	actionSetService.StoreActionSet("dashboards:view", []string{"dashboards:read"})

	type actionSetTest struct {
		desc                string
		permissions         []accesscontrol.Permission
		expectedPermissions []accesscontrol.Permission
	}

	tests := []actionSetTest{
		{
			desc:                "should return empty list if no permissions are passed in",
			permissions:         []accesscontrol.Permission{},
			expectedPermissions: []accesscontrol.Permission{},
		},
		{
			desc: "should return unchanged permissions if none of actions are part of any action sets",
			permissions: []accesscontrol.Permission{
				{
					Action: "datasources:create",
				},
				{
					Action: "users:read",
					Scope:  "users:*",
				},
			},
			expectedPermissions: []accesscontrol.Permission{
				{
					Action: "datasources:create",
				},
				{
					Action: "users:read",
					Scope:  "users:*",
				},
			},
		},
		{
			desc: "should return unchanged permissions if none of actions are part of any action sets",
			permissions: []accesscontrol.Permission{
				{
					Action: "datasources:create",
				},
				{
					Action: "users:read",
					Scope:  "users:*",
				},
			},
			expectedPermissions: []accesscontrol.Permission{
				{
					Action: "datasources:create",
				},
				{
					Action: "users:read",
					Scope:  "users:*",
				},
			},
		},
		{
			desc: "should be able to expand one permission and leave others unchanged",
			permissions: []accesscontrol.Permission{
				{
					Action: "folders:view",
					Scope:  "folders:uid:1",
				},
				{
					Action: "users:read",
					Scope:  "users:*",
				},
			},
			expectedPermissions: []accesscontrol.Permission{
				{
					Action: "folders:read",
					Scope:  "folders:uid:1",
				},
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:1",
				},
				{
					Action: "users:read",
					Scope:  "users:*",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			permissions := actionSetService.ExpandActionSets(tt.permissions)
			require.ElementsMatch(t, tt.expectedPermissions, permissions)
		})
	}
}

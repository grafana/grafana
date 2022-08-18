package resourcepermissions

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
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
	desc              string
	user              *user.SignedInUser
	numUsers          int
	actions           []string
	resource          string
	resourceID        string
	resourceAttribute string
	onlyManaged       bool
}

func TestIntegrationStore_GetResourcePermissions(t *testing.T) {
	tests := []getResourcePermissionsTest{
		{
			desc: "should return permissions for resource id",
			user: &user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}},
				}},
			numUsers:          3,
			actions:           []string{"datasources:query"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
		},
		{
			desc: "should return manage permissions for all resource ids",
			user: &user.SignedInUser{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}},
				}},
			numUsers:          3,
			actions:           []string{"datasources:query"},
			resource:          "datasources",
			resourceID:        "1",
			resourceAttribute: "uid",
			onlyManaged:       true,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			store, sql := setupTestEnv(t)

			err := sql.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
				role := &accesscontrol.Role{
					OrgID:   test.user.OrgID,
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

			seedResourcePermissions(t, store, sql, test.actions, test.resource, test.resourceID, test.resourceAttribute, test.numUsers)

			permissions, err := store.GetResourcePermissions(context.Background(), test.user.OrgID, GetResourcePermissionsQuery{
				User:              test.user,
				Actions:           test.actions,
				Resource:          test.resource,
				ResourceID:        test.resourceID,
				ResourceAttribute: test.resourceAttribute,
				OnlyManaged:       test.onlyManaged,
			})
			require.NoError(t, err)

			expectedLen := test.numUsers
			if !test.onlyManaged {
				expectedLen += 1
			}
			assert.Len(t, permissions, expectedLen)
		})
	}
}

func seedResourcePermissions(t *testing.T, store *store, sql *sqlstore.SQLStore, actions []string, resource, resourceID, resourceAttribute string, numUsers int) {
	t.Helper()
	for i := 0; i < numUsers; i++ {
		org, _ := sql.GetOrgByName("test")

		if org == nil {
			addedOrg, err := sql.CreateOrgWithMember("test", int64(i))
			require.NoError(t, err)
			org = &addedOrg
		}

		u, err := sql.CreateUser(context.Background(), user.CreateUserCommand{
			Login: fmt.Sprintf("user:%s%d", resourceID, i),
			OrgID: org.Id,
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
	sql := sqlstore.InitTestDB(t)
	return NewStore(sql), sql
}

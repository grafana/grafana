package database

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type setUserResourcePermissionsTest struct {
	desc       string
	orgID      int64
	userID     int64
	actions    []string
	resource   string
	resourceID string
	seeds      []accesscontrol.SetResourcePermissionsCommand
}

func TestAccessControlStore_SetUserResourcePermissions(t *testing.T) {
	tests := []setUserResourcePermissionsTest{
		{
			desc:       "should set resource permission for user",
			userID:     1,
			actions:    []string{"datasources:query"},
			resource:   "datasources",
			resourceID: "1",
		},
		{
			desc:       "should remove resource permission for user",
			orgID:      1,
			userID:     1,
			actions:    []string{},
			resource:   "datasources",
			resourceID: "1",
			seeds: []accesscontrol.SetResourcePermissionsCommand{
				{
					Actions:    []string{"datasources:query"},
					Resource:   "datasources",
					ResourceID: "1",
				},
			},
		},
		{
			desc:       "should add new resource permission for user",
			orgID:      1,
			userID:     1,
			actions:    []string{"datasources:query", "datasources:write"},
			resource:   "datasources",
			resourceID: "1",
			seeds: []accesscontrol.SetResourcePermissionsCommand{
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
				_, err := store.SetUserResourcePermissions(context.Background(), test.orgID, test.userID, s)
				require.NoError(t, err)
			}

			added, err := store.SetUserResourcePermissions(context.Background(), test.userID, test.userID, accesscontrol.SetResourcePermissionsCommand{
				Actions:    test.actions,
				Resource:   test.resource,
				ResourceID: test.resourceID,
			})

			require.NoError(t, err)
			assert.Len(t, added, len(test.actions))
			for _, p := range added {
				assert.Equal(t, getResourceScope(test.resource, test.resourceID), p.Scope)
			}
		})
	}
}

type setTeamResourcePermissionsTest struct {
	desc       string
	orgID      int64
	teamID     int64
	actions    []string
	resource   string
	resourceID string
	seeds      []accesscontrol.SetResourcePermissionsCommand
}

func TestAccessControlStore_SetTeamResourcePermissions(t *testing.T) {
	tests := []setTeamResourcePermissionsTest{
		{
			desc:       "should add new resource permission for team",
			orgID:      1,
			teamID:     1,
			actions:    []string{"datasources:query"},
			resource:   "datasources",
			resourceID: "1",
		},
		{
			desc:       "should add new resource permission when others exist",
			orgID:      1,
			teamID:     1,
			actions:    []string{"datasources:query", "datasources:write"},
			resource:   "datasources",
			resourceID: "1",
			seeds: []accesscontrol.SetResourcePermissionsCommand{
				{
					Actions:    []string{"datasources:query"},
					Resource:   "datasources",
					ResourceID: "1",
				},
			},
		},
		{
			desc:       "should remove permissions for team",
			orgID:      1,
			teamID:     1,
			actions:    []string{},
			resource:   "datasources",
			resourceID: "1",
			seeds: []accesscontrol.SetResourcePermissionsCommand{
				{
					Actions:    []string{"datasources:query"},
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
				_, err := store.SetTeamResourcePermissions(context.Background(), test.orgID, test.teamID, s)
				require.NoError(t, err)
			}

			added, err := store.SetTeamResourcePermissions(context.Background(), test.orgID, test.teamID, accesscontrol.SetResourcePermissionsCommand{
				Actions:    test.actions,
				Resource:   test.resource,
				ResourceID: test.resourceID,
			})

			require.NoError(t, err)
			assert.Len(t, added, len(test.actions))
			for _, p := range added {
				assert.Equal(t, getResourceScope(test.resource, test.resourceID), p.Scope)
			}
		})
	}
}

type setBuiltinResourcePermissionsTest struct {
	desc        string
	orgID       int64
	builtinRole string
	actions     []string
	resource    string
	resourceID  string
	seeds       []accesscontrol.SetResourcePermissionsCommand
}

func TestAccessControlStore_SetBuiltinResourcePermissions(t *testing.T) {
	tests := []setBuiltinResourcePermissionsTest{
		{
			desc:        "should add new resource permission for builtin role",
			orgID:       1,
			builtinRole: "Viewer",
			actions:     []string{"datasources:query"},
			resource:    "datasources",
			resourceID:  "1",
		},
		{
			desc:        "should add new resource permission when others exist",
			orgID:       1,
			builtinRole: "Viewer",
			actions:     []string{"datasources:query", "datasources:write"},
			resource:    "datasources",
			resourceID:  "1",
			seeds: []accesscontrol.SetResourcePermissionsCommand{
				{
					Actions:    []string{"datasources:query"},
					Resource:   "datasources",
					ResourceID: "1",
				},
			},
		},
		{
			desc:        "should remove permissions for builtin role",
			orgID:       1,
			builtinRole: "Viewer",
			actions:     []string{},
			resource:    "datasources",
			resourceID:  "1",
			seeds: []accesscontrol.SetResourcePermissionsCommand{
				{
					Actions:    []string{"datasources:query"},
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
				_, err := store.SetBuiltinResourcePermissions(context.Background(), test.orgID, test.builtinRole, s)
				require.NoError(t, err)
			}

			added, err := store.SetBuiltinResourcePermissions(context.Background(), test.orgID, test.builtinRole, accesscontrol.SetResourcePermissionsCommand{
				Actions:    test.actions,
				Resource:   test.resource,
				ResourceID: test.resourceID,
			})

			require.NoError(t, err)
			assert.Len(t, added, len(test.actions))
			for _, p := range added {
				assert.Equal(t, getResourceScope(test.resource, test.resourceID), p.Scope)
			}
		})
	}
}

type resourcePermission struct {
	resource   string
	resourceID string
}

type removeResourcePermissionTest struct {
	desc        string
	add         resourcePermission
	remove      resourcePermission
	expectedErr error
}

func TestAccessControlStore_RemoveResourcePermission(t *testing.T) {
	tests := []removeResourcePermissionTest{
		{
			desc: "should remove resource permission",
			add: resourcePermission{
				resource:   "datasources",
				resourceID: "1",
			},
			remove: resourcePermission{
				resource:   "datasources",
				resourceID: "1",
			},
			expectedErr: nil,
		},
		{
			desc: "should return nil when permission does not exist",
			add: resourcePermission{
				resource:   "datasources",
				resourceID: "1",
			},
			remove: resourcePermission{
				resource:   "datasources",
				resourceID: "2",
			},
			expectedErr: nil,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			store, sql := setupTestEnv(t)

			user, err := sql.CreateUser(context.Background(), models.CreateUserCommand{
				Login: "user",
				OrgId: 1,
			})
			require.NoError(t, err)

			// Seed with permission
			seeded, err := store.SetUserResourcePermissions(context.Background(), user.OrgId, user.Id, accesscontrol.SetResourcePermissionsCommand{
				Actions:    []string{"datasources:query"},
				Resource:   test.add.resource,
				ResourceID: test.add.resourceID,
			})
			require.NoError(t, err)

			err = store.RemoveResourcePermission(context.Background(), user.OrgId, accesscontrol.RemoveResourcePermissionCommand{
				Actions:      []string{"datasources:query"},
				Resource:     test.remove.resource,
				ResourceID:   test.remove.resourceID,
				PermissionID: seeded[0].ID,
			})

			if test.expectedErr != nil {
				assert.ErrorIs(t, err, test.expectedErr)
			} else {
				permissions, err := store.GetResourcesPermissions(context.Background(), user.OrgId, accesscontrol.GetResourcesPermissionsQuery{
					Actions:     []string{"datasources:query"},
					Resource:    test.add.resource,
					ResourceIDs: []string{test.add.resourceID},
				})
				assert.NoError(t, err)
				if test.add.resourceID != test.remove.resourceID {
					assert.Len(t, permissions, 1)
				} else {
					assert.Len(t, permissions, 0)
				}
			}
		})
	}
}

type getResourcesPermissionsTest struct {
	desc        string
	numUsers    int
	actions     []string
	resource    string
	resourceIDs []string
}

func TestAccessControlStore_GetResourcesPermissions(t *testing.T) {
	tests := []getResourcesPermissionsTest{
		{
			desc:        "should return permissions for all resource ids",
			numUsers:    3,
			actions:     []string{"datasources:query"},
			resource:    "datasources",
			resourceIDs: []string{"1", "2"},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			store, sql := setupTestEnv(t)

			for _, id := range test.resourceIDs {
				seedResourcePermissions(t, store, sql, test.actions, test.resource, id, test.numUsers)
			}

			permissions, err := store.GetResourcesPermissions(context.Background(), 1, accesscontrol.GetResourcesPermissionsQuery{
				Actions:     test.actions,
				Resource:    test.resource,
				ResourceIDs: test.resourceIDs,
			})
			require.NoError(t, err)

			expectedLen := test.numUsers * len(test.resourceIDs)
			assert.Len(t, permissions, expectedLen)
		})
	}
}

func seedResourcePermissions(t *testing.T, store *AccessControlStore, sql *sqlstore.SQLStore, actions []string, resource, resourceID string, numUsers int) {
	t.Helper()
	for i := 0; i < numUsers; i++ {
		org, _ := sql.GetOrgByName("test")

		if org == nil {
			addedOrg, err := sql.CreateOrgWithMember("test", int64(i))
			require.NoError(t, err)
			org = &addedOrg
		}

		u, err := sql.CreateUser(context.Background(), models.CreateUserCommand{
			Login: fmt.Sprintf("user:%s%d", resourceID, i),
			OrgId: org.Id,
		})
		require.NoError(t, err)

		_, err = store.SetUserResourcePermissions(context.Background(), 1, u.Id, accesscontrol.SetResourcePermissionsCommand{
			Actions:    actions,
			Resource:   resource,
			ResourceID: resourceID,
		})
		require.NoError(t, err)
	}
}

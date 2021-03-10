package database

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	actesting "github.com/grafana/grafana/pkg/services/accesscontrol/testing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// accessControlStoreTestImpl is a test store implementation which additionaly executes a database migrations
type accessControlStoreTestImpl struct {
	AccessControlStore
}

func init() {
	registry.RegisterService(&accessControlStoreTestImpl{})
}

func (ac *accessControlStoreTestImpl) Init() error {
	return nil
}

func (ac *accessControlStoreTestImpl) AddMigration(mg *migrator.Migrator) {
	AddAccessControlMigrations(mg)
}

func setupTestEnv(t testing.TB) *accessControlStoreTestImpl {
	cfg := setting.NewCfg()

	store := OverrideDatabaseInRegistry(cfg)

	sqlStore := sqlstore.InitTestDB(t)
	store.SQLStore = sqlStore

	err := store.Init()
	require.NoError(t, err)
	return &store
}

func OverrideDatabaseInRegistry(cfg *setting.Cfg) accessControlStoreTestImpl {
	store := accessControlStoreTestImpl{
		AccessControlStore: AccessControlStore{
			SQLStore: nil,
		},
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*AccessControlStore); ok {
			return &registry.Descriptor{
				Name:         "Database",
				Instance:     &store,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}

	registry.RegisterOverride(overrideServiceFunc)

	return store
}

func TestCreatingPolicy(t *testing.T) {
	MockTimeNow()
	defer ResetTimeNow()

	testCases := []struct {
		desc        string
		policy      actesting.PolicyTestCase
		permissions []actesting.PermissionTestCase

		expectedError   error
		expectedUpdated time.Time
	}{
		{
			desc: "should successfuly create simple policy",
			policy: actesting.PolicyTestCase{
				Name:        "a name",
				Permissions: nil,
			},
			expectedUpdated: time.Unix(1, 0).UTC(),
		},
		{
			desc: "should successfuly create policy with UID",
			policy: actesting.PolicyTestCase{
				Name:        "a name",
				UID:         "testUID",
				Permissions: nil,
			},
			expectedUpdated: time.Unix(3, 0).UTC(),
		},
		{
			desc: "should successfuly create policy with permissions",
			policy: actesting.PolicyTestCase{
				Name: "a name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "users", Permission: "admin.users:create"},
					{Scope: "reports", Permission: "reports:read"},
				},
			},
			expectedUpdated: time.Unix(5, 0).UTC(),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			createPolicyRes := actesting.CreatePolicy(t, store, tc.policy)

			res, err := store.GetPolicyByUID(context.Background(), 1, createPolicyRes.UID)
			policy := res

			require.NoError(t, err)
			assert.Equal(t, tc.expectedUpdated, policy.Updated)

			if tc.policy.UID != "" {
				assert.Equal(t, tc.policy.UID, policy.UID)
			}

			if tc.policy.Permissions == nil {
				assert.Empty(t, policy.Permissions)
			} else {
				assert.Equal(t, len(tc.policy.Permissions), len(policy.Permissions))
				for i, p := range policy.Permissions {
					assert.Equal(t, tc.policy.Permissions[i].Permission, p.Permission)
					assert.Equal(t, tc.policy.Permissions[i].Scope, p.Scope)
				}
			}
		})
	}
}

func TestUpdatingPolicy(t *testing.T) {
	MockTimeNow()
	defer ResetTimeNow()

	testCases := []struct {
		desc      string
		policy    actesting.PolicyTestCase
		newPolicy actesting.PolicyTestCase

		expectedError error
	}{
		{
			desc: "should successfuly update policy name",
			policy: actesting.PolicyTestCase{
				Name: "a name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "reports", Permission: "reports:read"},
				},
			},
			newPolicy: actesting.PolicyTestCase{
				Name: "a different name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "reports", Permission: "reports:create"},
					{Scope: "reports", Permission: "reports:read"},
				},
			},
		},
		{
			desc: "should successfuly create policy with permissions",
			policy: actesting.PolicyTestCase{
				Name: "a name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "users", Permission: "admin.users:create"},
					{Scope: "reports", Permission: "reports:read"},
				},
			},
			newPolicy: actesting.PolicyTestCase{
				Name: "a different name",
				Permissions: []actesting.PermissionTestCase{
					{Scope: "users", Permission: "admin.users:read"},
					{Scope: "reports", Permission: "reports:create"},
				},
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			policy := actesting.CreatePolicy(t, store, tc.policy)
			updated := policy.Updated

			updatePolicyCmd := accesscontrol.UpdatePolicyCommand{
				UID:  policy.UID,
				Name: tc.newPolicy.Name,
			}
			for _, perm := range tc.newPolicy.Permissions {
				updatePolicyCmd.Permissions = append(updatePolicyCmd.Permissions, accesscontrol.Permission{
					Permission: perm.Permission,
					Scope:      perm.Scope,
				})
			}

			_, err := store.UpdatePolicy(context.Background(), updatePolicyCmd)
			require.NoError(t, err)

			updatedPolicy, err := store.GetPolicyByUID(context.Background(), 1, policy.UID)

			require.NoError(t, err)
			assert.Equal(t, tc.newPolicy.Name, updatedPolicy.Name)
			assert.True(t, updatedPolicy.Updated.After(updated))
			assert.Equal(t, len(tc.newPolicy.Permissions), len(updatedPolicy.Permissions))

			// Check permissions
			require.NoError(t, err)
			for i, updatedPermission := range updatedPolicy.Permissions {
				assert.Equal(t, tc.newPolicy.Permissions[i].Permission, updatedPermission.Permission)
				assert.Equal(t, tc.newPolicy.Permissions[i].Scope, updatedPermission.Scope)
			}
		})
	}
}

type userPolicyTestCase struct {
	desc         string
	userName     string
	teamName     string
	userPolicies []actesting.PolicyTestCase
	teamPolicies []actesting.PolicyTestCase

	expectedError  error
	expectedAccess bool
}

func TestUserPolicy(t *testing.T) {
	MockTimeNow()
	defer ResetTimeNow()

	testCases := []userPolicyTestCase{
		{
			desc:     "should successfuly get user policies",
			userName: "testuser",
			teamName: "team1",
			userPolicies: []actesting.PolicyTestCase{
				{
					Name: "CreateUser", Permissions: []actesting.PermissionTestCase{},
				},
			},
			teamPolicies:   nil,
			expectedError:  nil,
			expectedAccess: false,
		},
		{
			desc:     "should successfuly get user and team policies",
			userName: "testuser",
			teamName: "team1",
			userPolicies: []actesting.PolicyTestCase{
				{
					Name: "CreateUser", Permissions: []actesting.PermissionTestCase{},
				},
			},
			teamPolicies: []actesting.PolicyTestCase{
				{
					Name: "CreateDataSource", Permissions: []actesting.PermissionTestCase{},
				},
				{
					Name: "EditDataSource", Permissions: []actesting.PermissionTestCase{},
				},
			},
			expectedError:  nil,
			expectedAccess: false,
		},
		{
			desc:         "should successfuly get user and team policies if user has no policies",
			userName:     "testuser",
			teamName:     "team1",
			userPolicies: nil,
			teamPolicies: []actesting.PolicyTestCase{
				{
					Name: "CreateDataSource", Permissions: []actesting.PermissionTestCase{},
				},
				{
					Name: "EditDataSource", Permissions: []actesting.PermissionTestCase{},
				},
			},
			expectedError:  nil,
			expectedAccess: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			actesting.CreateUserWithPolicy(t, store, tc.userName, tc.userPolicies)
			actesting.CreateTeamWithPolicy(t, store, tc.teamName, tc.teamPolicies)

			// Create more teams
			for i := 0; i < 10; i++ {
				teamName := fmt.Sprintf("faketeam%v", i)
				policies := []actesting.PolicyTestCase{
					{
						Name: fmt.Sprintf("fakepolicy%v", i),
						Permissions: []actesting.PermissionTestCase{
							{Scope: "datasources", Permission: "datasources:create"},
						},
					},
				}
				actesting.CreateTeamWithPolicy(t, store, teamName, policies)
			}

			userQuery := models.GetUserByLoginQuery{
				LoginOrEmail: tc.userName,
			}
			err := sqlstore.GetUserByLogin(&userQuery)
			require.NoError(t, err)
			userId := userQuery.Result.Id

			teamQuery := models.SearchTeamsQuery{
				OrgId: 1,
				Name:  tc.teamName,
			}
			err = sqlstore.SearchTeams(&teamQuery)
			require.NoError(t, err)
			require.Len(t, teamQuery.Result.Teams, 1)
			teamId := teamQuery.Result.Teams[0].Id

			addTeamMemberCmd := models.AddTeamMemberCommand{
				OrgId:  1,
				UserId: userId,
				TeamId: teamId,
			}
			err = sqlstore.AddTeamMember(&addTeamMemberCmd)
			require.NoError(t, err)

			userPoliciesQuery := accesscontrol.GetUserPoliciesQuery{
				OrgId:  1,
				UserId: userQuery.Result.Id,
			}

			res, err := store.GetUserPolicies(context.Background(), userPoliciesQuery)
			require.NoError(t, err)
			assert.Equal(t, len(tc.userPolicies)+len(tc.teamPolicies), len(res))
		})
	}
}

type userTeamPolicyTestCase struct {
	desc         string
	userName     string
	teamName     string
	userPolicies []actesting.PolicyTestCase
	teamPolicies []actesting.PolicyTestCase

	expectedError  error
	expectedAccess bool
}

func TestUserPermissions(t *testing.T) {
	MockTimeNow()
	defer ResetTimeNow()

	testCases := []userTeamPolicyTestCase{
		{
			desc:     "should successfuly get user and team permissions",
			userName: "testuser",
			teamName: "team1",
			userPolicies: []actesting.PolicyTestCase{
				{
					Name: "CreateUser", Permissions: []actesting.PermissionTestCase{
						{Scope: "users", Permission: "admin.users:create"},
						{Scope: "reports", Permission: "reports:read"},
					},
				},
			},
			teamPolicies: []actesting.PolicyTestCase{
				{
					Name: "CreateDataSource", Permissions: []actesting.PermissionTestCase{
						{Scope: "datasources", Permission: "datasources:create"},
					},
				},
			},
			expectedError:  nil,
			expectedAccess: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			store := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			actesting.CreateUserWithPolicy(t, store, tc.userName, tc.userPolicies)
			actesting.CreateTeamWithPolicy(t, store, tc.teamName, tc.teamPolicies)

			// Create more teams
			for i := 0; i < 10; i++ {
				teamName := fmt.Sprintf("faketeam%v", i)
				policies := []actesting.PolicyTestCase{
					{
						Name: fmt.Sprintf("fakepolicy%v", i),
						Permissions: []actesting.PermissionTestCase{
							{Scope: "datasources", Permission: "datasources:create"},
						},
					},
				}
				actesting.CreateTeamWithPolicy(t, store, teamName, policies)
			}

			userQuery := models.GetUserByLoginQuery{
				LoginOrEmail: tc.userName,
			}
			err := sqlstore.GetUserByLogin(&userQuery)
			require.NoError(t, err)
			userId := userQuery.Result.Id

			teamQuery := models.SearchTeamsQuery{
				OrgId: 1,
				Name:  tc.teamName,
			}
			err = sqlstore.SearchTeams(&teamQuery)
			require.NoError(t, err)
			require.Len(t, teamQuery.Result.Teams, 1)
			teamId := teamQuery.Result.Teams[0].Id

			addTeamMemberCmd := models.AddTeamMemberCommand{
				OrgId:  1,
				UserId: userId,
				TeamId: teamId,
			}
			err = sqlstore.AddTeamMember(&addTeamMemberCmd)
			require.NoError(t, err)

			userPermissionsQuery := accesscontrol.GetUserPermissionsQuery{
				OrgId:  1,
				UserId: userId,
			}

			getUserTeamsQuery := models.GetTeamsByUserQuery{
				OrgId:  1,
				UserId: userId,
			}
			err = sqlstore.GetTeamsByUser(&getUserTeamsQuery)
			require.NoError(t, err)
			require.Len(t, getUserTeamsQuery.Result, 1)

			expectedPermissions := []actesting.PermissionTestCase{}
			for _, p := range tc.userPolicies {
				expectedPermissions = append(expectedPermissions, p.Permissions...)
			}
			for _, p := range tc.teamPolicies {
				expectedPermissions = append(expectedPermissions, p.Permissions...)
			}

			res, err := store.GetUserPermissions(context.Background(), userPermissionsQuery)
			require.NoError(t, err)
			assert.Equal(t, len(expectedPermissions), len(res))
			assert.Contains(t, expectedPermissions, actesting.PermissionTestCase{Scope: "datasources", Permission: "datasources:create"})
			assert.NotContains(t, expectedPermissions, actesting.PermissionTestCase{Scope: "/api/restricted", Permission: "restricted:read"})
		})
	}
}

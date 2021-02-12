package rbac

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreatingPolicy(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	testCases := []struct {
		desc        string
		policy      policyTestCase
		inputName   string
		permissions []permissionTestCase

		expectedError   error
		expectedUpdated time.Time
	}{
		{
			desc: "should successfuly create simple policy",
			policy: policyTestCase{
				name:        "a name",
				permissions: nil,
			},
			expectedUpdated: time.Unix(1, 0).UTC(),
		},
		{
			desc: "should successfuly create policy with permissions",
			policy: policyTestCase{
				name: "a name",
				permissions: []permissionTestCase{
					{scope: "/api/admin/users", permission: "post"},
					{scope: "/api/report", permission: "get"},
				},
			},
			expectedUpdated: time.Unix(3, 0).UTC(),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			policyId := createPolicy(t, ac, tc.policy)

			res, err := ac.GetPolicy(context.Background(), 1, policyId)
			policy := res

			require.NoError(t, err)
			assert.Equal(t, tc.expectedUpdated, policy.Updated)
			if tc.policy.permissions == nil {
				assert.Empty(t, policy.Permissions)
			} else {
				assert.Equal(t, len(tc.policy.permissions), len(policy.Permissions))
				for i, p := range policy.Permissions {
					assert.Equal(t, tc.policy.permissions[i].permission, p.Permission)
					assert.Equal(t, tc.policy.permissions[i].scope, p.Scope)
				}
			}
		})
	}
}

func TestUpdatingPolicy(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	testCases := []struct {
		desc      string
		policy    policyTestCase
		newPolicy policyTestCase

		expectedError   error
		expectedUpdated time.Time
	}{
		{
			desc: "should successfuly update policy name",
			policy: policyTestCase{
				name: "a name",
			},
			newPolicy: policyTestCase{
				name: "a different name",
			},
			expectedUpdated: time.Unix(1, 0).UTC(),
		},
		{
			desc: "should successfuly create policy with permissions",
			policy: policyTestCase{
				name: "a name",
				permissions: []permissionTestCase{
					{scope: "/api/admin/users", permission: "post"},
					{scope: "/api/report", permission: "get"},
				},
			},
			newPolicy: policyTestCase{
				name: "a different name",
				permissions: []permissionTestCase{
					{scope: "/api/admin/users", permission: "put"},
					{scope: "/api/report", permission: "post"},
				},
			},
			expectedUpdated: time.Unix(3, 0).UTC(),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			policyId := createPolicy(t, ac, tc.policy)

			updatePolicyCmd := UpdatePolicyCommand{
				Id:   policyId,
				Name: tc.newPolicy.name,
			}

			_, err := ac.UpdatePolicy(context.Background(), updatePolicyCmd)
			require.NoError(t, err)

			if tc.newPolicy.permissions != nil {
				// Update permissions
				perm, err := ac.GetPolicyPermissions(context.Background(), policyId)
				require.NoError(t, err)
				for _, reqP := range tc.newPolicy.permissions {
					for _, p := range perm {
						if reqP.scope == p.Scope {
							if reqP.permission != p.Permission {
								updatePermCmd := UpdatePermissionCommand{
									Id:         p.Id,
									Permission: reqP.permission,
								}
								_, err = ac.UpdatePermission(&updatePermCmd)
								require.NoError(t, err)
							}
						}
					}
				}

				// Check updated
				perm, err = ac.GetPolicyPermissions(context.Background(), policyId)
				require.NoError(t, err)
				for _, reqP := range tc.newPolicy.permissions {
					for _, p := range perm {
						if reqP.scope == p.Scope {
							require.Equal(t, reqP.permission, p.Permission)
						}
					}
				}
			}
		})
	}
}

type userPolicyTestCase struct {
	desc         string
	userName     string
	teamName     string
	userPolicies []policyTestCase
	teamPolicies []policyTestCase

	expectedError  error
	expectedAccess bool
}

func TestUserPolicy(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	testCases := []userPolicyTestCase{
		{
			desc:     "should successfuly get user policies",
			userName: "testuser",
			teamName: "team1",
			userPolicies: []policyTestCase{
				{
					name: "CreateUser", permissions: []permissionTestCase{},
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
			userPolicies: []policyTestCase{
				{
					name: "CreateUser", permissions: []permissionTestCase{},
				},
			},
			teamPolicies: []policyTestCase{
				{
					name: "CreateDataSource", permissions: []permissionTestCase{},
				},
				{
					name: "EditDataSource", permissions: []permissionTestCase{},
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
			teamPolicies: []policyTestCase{
				{
					name: "CreateDataSource", permissions: []permissionTestCase{},
				},
				{
					name: "EditDataSource", permissions: []permissionTestCase{},
				},
			},
			expectedError:  nil,
			expectedAccess: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			createUserWithPolicy(t, ac, tc.userName, tc.userPolicies)
			createTeamWithPolicy(t, ac, tc.teamName, tc.teamPolicies)

			// Create more teams
			for i := 0; i < 10; i++ {
				teamName := fmt.Sprintf("faketeam%v", i)
				policies := []policyTestCase{
					{
						name: fmt.Sprintf("fakepolicy%v", i),
						permissions: []permissionTestCase{
							{scope: "/api/datasources", permission: "put"},
						},
					},
				}
				createTeamWithPolicy(t, ac, teamName, policies)
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

			userPoliciesQuery := GetUserPoliciesQuery{
				OrgId:  1,
				UserId: userQuery.Result.Id,
			}

			res, err := ac.GetUserPolicies(&userPoliciesQuery)
			require.NoError(t, err)
			assert.Equal(t, len(tc.userPolicies)+len(tc.teamPolicies), len(res))
		})
	}
}

type userTeamPolicyTestCase struct {
	desc         string
	userName     string
	teamName     string
	userPolicies []policyTestCase
	teamPolicies []policyTestCase

	expectedError  error
	expectedAccess bool
}

func TestUserPermissions(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	testCases := []userTeamPolicyTestCase{
		{
			desc:     "should successfuly get user and team permissions",
			userName: "testuser",
			teamName: "team1",
			userPolicies: []policyTestCase{
				{
					name: "CreateUser", permissions: []permissionTestCase{
						{scope: "/api/admin/users", permission: "post"},
						{scope: "/api/report", permission: "get"},
					},
				},
			},
			teamPolicies: []policyTestCase{
				{
					name: "CreateDataSource", permissions: []permissionTestCase{
						{scope: "/api/datasources", permission: "put"},
					},
				},
			},
			expectedError:  nil,
			expectedAccess: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			createUserWithPolicy(t, ac, tc.userName, tc.userPolicies)
			createTeamWithPolicy(t, ac, tc.teamName, tc.teamPolicies)

			// Create more teams
			for i := 0; i < 10; i++ {
				teamName := fmt.Sprintf("faketeam%v", i)
				policies := []policyTestCase{
					{
						name: fmt.Sprintf("fakepolicy%v", i),
						permissions: []permissionTestCase{
							{scope: "/api/datasources", permission: "put"},
						},
					},
				}
				createTeamWithPolicy(t, ac, teamName, policies)
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

			userPermissionsQuery := GetUserPermissionsQuery{
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

			expectedPermissions := []permissionTestCase{}
			for _, p := range tc.userPolicies {
				expectedPermissions = append(expectedPermissions, p.permissions...)
			}
			for _, p := range tc.teamPolicies {
				expectedPermissions = append(expectedPermissions, p.permissions...)
			}

			res, err := ac.GetUserPermissions(&userPermissionsQuery)
			require.NoError(t, err)
			assert.Equal(t, len(expectedPermissions), len(res))
			assert.Contains(t, expectedPermissions, permissionTestCase{scope: "/api/datasources", permission: "put"})
			assert.NotContains(t, expectedPermissions, permissionTestCase{scope: "/api/restricted", permission: "post"})
		})
	}
}

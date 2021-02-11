package rbac

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type evaluatingPermissionsTestCase struct {
	desc     string
	endpoint string
	action   string
	userName string
	policies []policyTestCase

	expectedError  error
	expectedAccess bool
}

func TestEvaluatingPermissions(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()

	testCases := []evaluatingPermissionsTestCase{
		{
			desc:     "should successfuly evaluate access to the endpoint",
			endpoint: "/api/admin/users",
			action:   "post",
			userName: "testuser",
			policies: []policyTestCase{
				{
					name: "CreateUser", permissions: []permissionTestCase{
						{scope: "/api/admin/users", permission: "post"},
						{scope: "/api/report", permission: "get"},
					},
				},
			},
			expectedError:  nil,
			expectedAccess: true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			createUserWithPolicy(t, ac, tc.userName, tc.policies)

			userQuery := models.GetUserByLoginQuery{
				LoginOrEmail: tc.userName,
			}
			err := sqlstore.GetUserByLogin(&userQuery)
			require.NoError(t, err)

			userPoliciesQuery := GetUserPoliciesQuery{
				OrgId:  1,
				UserId: userQuery.Result.Id,
			}

			res, err := ac.GetUserPolicies(&userPoliciesQuery)
			require.NoError(t, err)
			assert.Equal(t, len(tc.policies), len(res))

			userPermissionsQuery := GetUserPermissionsQuery{
				OrgId:  1,
				UserId: userQuery.Result.Id,
			}

			permissions, err := ac.GetUserPermissions(&userPermissionsQuery)
			require.NoError(t, err)
			assert.Equal(t, len(tc.policies[0].permissions), len(permissions))
		})
	}
}

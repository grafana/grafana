package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	actesting "github.com/grafana/grafana/pkg/services/accesscontrol/testing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func overrideAccessControlInRegistry(cfg *setting.Cfg) AccessControlService {
	ac := AccessControlService{
		Cfg:           cfg,
		RouteRegister: routing.NewRouteRegister(),
		Log:           log.New("accesscontrol-test"),
		AccessControlStore: &database.AccessControlStore{
			SQLStore: nil,
		},
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*AccessControlService); ok {
			return &registry.Descriptor{
				Name:         "AccessControl",
				Instance:     &ac,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}

	registry.RegisterOverride(overrideServiceFunc)

	return ac
}

func setupTestEnv(t testing.TB) *AccessControlService {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

	ac := overrideAccessControlInRegistry(cfg)

	sqlStore := sqlstore.InitTestDB(t)
	ac.AccessControlStore.SQLStore = sqlStore

	err := ac.Init()
	require.NoError(t, err)
	return &ac
}

type evaluatingPermissionsTestCase struct {
	desc     string
	userName string
	roles    []actesting.RoleTestCase
}

func TestEvaluatingPermissions(t *testing.T) {
	database.MockTimeNow()
	defer database.ResetTimeNow()

	testCases := []evaluatingPermissionsTestCase{
		{
			desc:     "should successfully evaluate access to the endpoint",
			userName: "testuser",
			roles: []actesting.RoleTestCase{
				{
					Name: "CreateUser", Permissions: []actesting.PermissionTestCase{
						{Scope: "/api/admin/users", Permission: "post"},
						{Scope: "/api/report", Permission: "get"},
					},
				},
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			actesting.CreateUserWithRole(t, ac, tc.userName, tc.roles)

			userQuery := models.GetUserByLoginQuery{
				LoginOrEmail: tc.userName,
			}
			err := sqlstore.GetUserByLogin(&userQuery)
			require.NoError(t, err)

			userRolesQuery := accesscontrol.GetUserRolesQuery{
				OrgId:  1,
				UserId: userQuery.Result.Id,
			}

			res, err := ac.GetUserRoles(context.Background(), userRolesQuery)
			require.NoError(t, err)
			assert.Len(t, res, len(tc.roles))

			userPermissionsQuery := accesscontrol.GetUserPermissionsQuery{
				OrgId:  1,
				UserId: userQuery.Result.Id,
			}

			permissions, err := ac.GetUserPermissions(context.Background(), userPermissionsQuery)
			require.NoError(t, err)
			assert.Len(t, permissions, len(tc.roles[0].Permissions))
		})
	}
}

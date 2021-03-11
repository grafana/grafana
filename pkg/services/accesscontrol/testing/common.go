package testing

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

type RoleTestCase struct {
	Name        string
	UID         string
	Permissions []PermissionTestCase
}

type PermissionTestCase struct {
	Permission string
	Scope      string
}

// func OverrideRBACInRegistry(cfg *setting.Cfg) manager.AccessControlService {
// 	ac := manager.AccessControlService{
// 		Cfg:           cfg,
// 		RouteRegister: routing.NewRouteRegister(),
// 		Log:           log.New("rbac-test"),
// 		AccessControlStore: &database.AccessControlStore{
// 			SQLStore: nil,
// 		},
// 	}

// 	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
// 		if _, ok := descriptor.Instance.(*manager.AccessControlService); ok {
// 			return &registry.Descriptor{
// 				Name:         "RBAC",
// 				Instance:     &ac,
// 				InitPriority: descriptor.InitPriority,
// 			}, true
// 		}
// 		return nil, false
// 	}

// 	registry.RegisterOverride(overrideServiceFunc)

// 	return ac
// }

// func SetupTestEnv(t testing.TB) *manager.AccessControlService {
// 	cfg := setting.NewCfg()

// 	ac := OverrideRBACInRegistry(cfg)

// 	sqlStore := sqlstore.InitTestDB(t)
// 	ac.AccessControlStore.SQLStore = sqlStore

// 	err := ac.Init()
// 	require.NoError(t, err)
// 	return &ac
// }

func CreateRole(t *testing.T, ac accesscontrol.Store, p RoleTestCase) *accesscontrol.RoleDTO {
	createRoleCmd := accesscontrol.CreateRoleWithPermissionsCommand{
		OrgId:       1,
		UID:         p.UID,
		Name:        p.Name,
		Permissions: []accesscontrol.Permission{},
	}
	for _, perm := range p.Permissions {
		createRoleCmd.Permissions = append(createRoleCmd.Permissions, accesscontrol.Permission{
			Permission: perm.Permission,
			Scope:      perm.Scope,
		})
	}

	res, err := ac.CreateRoleWithPermissions(context.Background(), createRoleCmd)
	require.NoError(t, err)

	return res
}

func CreateUserWithRole(t *testing.T, ac accesscontrol.Store, user string, roles []RoleTestCase) {
	createUserCmd := models.CreateUserCommand{
		Email: user + "@test.com",
		Name:  user,
		Login: user,
		OrgId: 1,
	}

	err := sqlstore.CreateUser(context.Background(), &createUserCmd)
	require.NoError(t, err)
	userId := createUserCmd.Result.Id

	for _, p := range roles {
		createRoleCmd := accesscontrol.CreateRoleCommand{
			OrgId: 1,
			Name:  p.Name,
		}
		res, err := ac.CreateRole(context.Background(), createRoleCmd)
		require.NoError(t, err)
		roleId := res.Id

		for _, perm := range p.Permissions {
			permCmd := accesscontrol.CreatePermissionCommand{
				RoleId:     roleId,
				Permission: perm.Permission,
				Scope:      perm.Scope,
			}

			_, err := ac.CreatePermission(context.Background(), permCmd)
			require.NoError(t, err)
		}

		addUserRoleCmd := accesscontrol.AddUserRoleCommand{
			OrgId:  1,
			RoleId: roleId,
			UserId: userId,
		}
		err = ac.AddUserRole(&addUserRoleCmd)
		require.NoError(t, err)
	}
}

func CreateTeamWithRole(t *testing.T, ac accesscontrol.Store, team string, roles []RoleTestCase) {
	createTeamCmd := models.CreateTeamCommand{OrgId: 1, Name: team, Email: team + "@test.com"}
	err := sqlstore.CreateTeam(&createTeamCmd)
	require.NoError(t, err)
	teamId := createTeamCmd.Result.Id

	for _, p := range roles {
		createRoleCmd := accesscontrol.CreateRoleCommand{
			OrgId: 1,
			Name:  p.Name,
		}
		res, err := ac.CreateRole(context.Background(), createRoleCmd)
		require.NoError(t, err)
		roleId := res.Id

		for _, perm := range p.Permissions {
			permCmd := accesscontrol.CreatePermissionCommand{
				RoleId:     roleId,
				Permission: perm.Permission,
				Scope:      perm.Scope,
			}

			_, err := ac.CreatePermission(context.Background(), permCmd)
			require.NoError(t, err)
		}

		addTeamRoleCmd := accesscontrol.AddTeamRoleCommand{
			OrgId:  1,
			RoleId: roleId,
			TeamId: teamId,
		}
		err = ac.AddTeamRole(&addTeamRoleCmd)
		require.NoError(t, err)
	}
}

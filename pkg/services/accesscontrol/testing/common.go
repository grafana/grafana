package testing

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

type PolicyTestCase struct {
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

func CreatePolicy(t *testing.T, ac accesscontrol.Store, p PolicyTestCase) *accesscontrol.PolicyDTO {
	createPolicyCmd := accesscontrol.CreatePolicyWithPermissionsCommand{
		OrgId:       1,
		UID:         p.UID,
		Name:        p.Name,
		Permissions: []accesscontrol.Permission{},
	}
	for _, perm := range p.Permissions {
		createPolicyCmd.Permissions = append(createPolicyCmd.Permissions, accesscontrol.Permission{
			Permission: perm.Permission,
			Scope:      perm.Scope,
		})
	}

	res, err := ac.CreatePolicyWithPermissions(context.Background(), createPolicyCmd)
	require.NoError(t, err)

	return res
}

func CreateUserWithPolicy(t *testing.T, ac accesscontrol.Store, user string, policies []PolicyTestCase) {
	createUserCmd := models.CreateUserCommand{
		Email: user + "@test.com",
		Name:  user,
		Login: user,
		OrgId: 1,
	}

	err := sqlstore.CreateUser(context.Background(), &createUserCmd)
	require.NoError(t, err)
	userId := createUserCmd.Result.Id

	for _, p := range policies {
		createPolicyCmd := accesscontrol.CreatePolicyCommand{
			OrgId: 1,
			Name:  p.Name,
		}
		res, err := ac.CreatePolicy(context.Background(), createPolicyCmd)
		require.NoError(t, err)
		policyId := res.Id

		for _, perm := range p.Permissions {
			permCmd := accesscontrol.CreatePermissionCommand{
				PolicyId:   policyId,
				Permission: perm.Permission,
				Scope:      perm.Scope,
			}

			_, err := ac.CreatePermission(context.Background(), permCmd)
			require.NoError(t, err)
		}

		addUserPolicyCmd := accesscontrol.AddUserPolicyCommand{
			OrgId:    1,
			PolicyId: policyId,
			UserId:   userId,
		}
		err = ac.AddUserPolicy(&addUserPolicyCmd)
		require.NoError(t, err)
	}
}

func CreateTeamWithPolicy(t *testing.T, ac accesscontrol.Store, team string, policies []PolicyTestCase) {
	createTeamCmd := models.CreateTeamCommand{OrgId: 1, Name: team, Email: team + "@test.com"}
	err := sqlstore.CreateTeam(&createTeamCmd)
	require.NoError(t, err)
	teamId := createTeamCmd.Result.Id

	for _, p := range policies {
		createPolicyCmd := accesscontrol.CreatePolicyCommand{
			OrgId: 1,
			Name:  p.Name,
		}
		res, err := ac.CreatePolicy(context.Background(), createPolicyCmd)
		require.NoError(t, err)
		policyId := res.Id

		for _, perm := range p.Permissions {
			permCmd := accesscontrol.CreatePermissionCommand{
				PolicyId:   policyId,
				Permission: perm.Permission,
				Scope:      perm.Scope,
			}

			_, err := ac.CreatePermission(context.Background(), permCmd)
			require.NoError(t, err)
		}

		addTeamPolicyCmd := accesscontrol.AddTeamPolicyCommand{
			OrgId:    1,
			PolicyId: policyId,
			TeamId:   teamId,
		}
		err = ac.AddTeamPolicy(&addTeamPolicyCmd)
		require.NoError(t, err)
	}
}

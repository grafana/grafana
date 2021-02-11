package rbac

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func overrideRBACInRegistry(cfg *setting.Cfg) RBACService {
	ac := RBACService{
		SQLStore:      nil,
		Cfg:           cfg,
		RouteRegister: routing.NewRouteRegister(),
		log:           log.New("rbac-test"),
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*RBACService); ok {
			return &registry.Descriptor{
				Name:         "RBAC",
				Instance:     &ac,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}

	registry.RegisterOverride(overrideServiceFunc)

	return ac
}

func mockTimeNow() {
	var timeSeed int64
	timeNow = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0).UTC()
		timeSeed++
		return fakeNow
	}
}

func resetTimeNow() {
	timeNow = time.Now
}

func setupTestEnv(t *testing.T) *RBACService {
	cfg := setting.NewCfg()

	ac := overrideRBACInRegistry(cfg)

	sqlStore := sqlstore.InitTestDB(t)
	ac.SQLStore = sqlStore

	err := ac.Init()
	require.NoError(t, err)
	return &ac
}

type policyTestCase struct {
	name        string
	permissions []permissionTestCase
}

type permissionTestCase struct {
	permission string
	scope      string
}

func createPolicy(t *testing.T, ac *RBACService, p policyTestCase) int64 {
	createPolicyCmd := CreatePolicyCommand{
		OrgId: 1,
		Name:  p.name,
	}
	res, err := ac.CreatePolicy(context.Background(), createPolicyCmd)
	require.NoError(t, err)
	policyId := res.Id

	for _, perm := range p.permissions {
		permCmd := CreatePermissionCommand{
			PolicyId:   policyId,
			Permission: perm.permission,
			Scope:      perm.scope,
		}

		_, err := ac.CreatePermission(&permCmd)
		require.NoError(t, err)
	}

	return policyId
}

func createUserWithPolicy(t *testing.T, ac *RBACService, user string, policies []policyTestCase) {
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
		createPolicyCmd := CreatePolicyCommand{
			OrgId: 1,
			Name:  p.name,
		}
		res, err := ac.CreatePolicy(context.Background(), createPolicyCmd)
		require.NoError(t, err)
		policyId := res.Id

		for _, perm := range p.permissions {
			permCmd := CreatePermissionCommand{
				PolicyId:   policyId,
				Permission: perm.permission,
				Scope:      perm.scope,
			}

			_, err := ac.CreatePermission(&permCmd)
			require.NoError(t, err)
		}

		addUserPolicyCmd := AddUserPolicyCommand{
			OrgId:    1,
			PolicyId: policyId,
			UserId:   userId,
		}
		err = ac.AddUserPolicy(&addUserPolicyCmd)
		require.NoError(t, err)
	}
}

func createTeamWithPolicy(t *testing.T, ac *RBACService, team string, policies []policyTestCase) {
	createTeamCmd := models.CreateTeamCommand{OrgId: 1, Name: "team1", Email: "team1@test.com"}
	err := sqlstore.CreateTeam(&createTeamCmd)
	require.NoError(t, err)
	teamId := createTeamCmd.Result.Id

	for _, p := range policies {
		createPolicyCmd := CreatePolicyCommand{
			OrgId: 1,
			Name:  p.name,
		}
		res, err := ac.CreatePolicy(context.Background(), createPolicyCmd)
		require.NoError(t, err)
		policyId := res.Id

		for _, perm := range p.permissions {
			permCmd := CreatePermissionCommand{
				PolicyId:   policyId,
				Permission: perm.permission,
				Scope:      perm.scope,
			}

			_, err := ac.CreatePermission(&permCmd)
			require.NoError(t, err)
		}

		addTeamPolicyCmd := AddTeamPolicyCommand{
			OrgId:    1,
			PolicyId: policyId,
			TeamId:   teamId,
		}
		err = ac.AddTeamPolicy(&addTeamPolicyCmd)
		require.NoError(t, err)
	}
}

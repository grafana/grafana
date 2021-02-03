package rbac

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

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
	permissions []struct {
		permission string
		scope      string
	}
}

func createUserWithPolicy(t *testing.T, user string, policies []policyTestCase) {
	ac := setupTestEnv(t)
	t.Cleanup(registry.ClearOverrides)

	createUserCmd := models.CreateUserCommand{
		Email: user + "@test.com",
		Name:  user,
		Login: user,
	}

	err := sqlstore.CreateUser(context.Background(), &createUserCmd)
	require.NoError(t, err)
	userId := createUserCmd.Result.Id

	for _, p := range policies {
		createPolicyCmd := CreatePolicyCommand{
			OrgId: 1,
			Name:  p.name,
		}
		err := ac.CreatePolicy(&createPolicyCmd)
		require.NoError(t, err)
		policyId := createPolicyCmd.Result.Id

		for _, perm := range p.permissions {
			permCmd := CreatePermissionCommand{
				OrgId:      1,
				PolicyId:   policyId,
				Permission: perm.permission,
				Scope:      perm.scope,
			}

			err := ac.CreatePermission(&permCmd)
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

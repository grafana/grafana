package ossaccesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

func setupTestEnv(t testing.TB) *OSSAccessControlService {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

	ac := OSSAccessControlService{
		Cfg: cfg,
		Log: log.New("accesscontrol-test"),
	}

	err := ac.Init()
	require.NoError(t, err)
	return &ac
}

type evaluatingPermissionsTestCase struct {
	desc       string
	user       userTestCase
	endpoints  []endpointTestCase
	evalResult bool
}

type userTestCase struct {
	name           string
	orgRole        models.RoleType
	isGrafanaAdmin bool
}

type endpointTestCase struct {
	permission string
	scope      []string
}

func TestEvaluatingPermissions(t *testing.T) {
	testCases := []evaluatingPermissionsTestCase{
		{
			desc: "should successfully evaluate access to the endpoint",
			user: userTestCase{
				name:           "testuser",
				orgRole:        "Grafana Admin",
				isGrafanaAdmin: false,
			},
			endpoints: []endpointTestCase{
				{permission: accesscontrol.ActionUsersDisable, scope: []string{accesscontrol.ScopeUsersAll}},
				{permission: accesscontrol.ActionUsersEnable, scope: []string{accesscontrol.ScopeUsersAll}},
			},
			evalResult: true,
		},
		{
			desc: "should restrict access to the unauthorized endpoints",
			user: userTestCase{
				name:           "testuser",
				orgRole:        models.ROLE_VIEWER,
				isGrafanaAdmin: false,
			},
			endpoints: []endpointTestCase{
				{permission: accesscontrol.ActionUsersCreate, scope: []string{accesscontrol.ScopeUsersAll}},
			},
			evalResult: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			ac := setupTestEnv(t)
			t.Cleanup(registry.ClearOverrides)

			user := &models.SignedInUser{
				UserId:         1,
				OrgId:          1,
				Name:           tc.user.name,
				OrgRole:        tc.user.orgRole,
				IsGrafanaAdmin: tc.user.isGrafanaAdmin,
			}

			for _, endpoint := range tc.endpoints {
				result, err := ac.Evaluate(context.Background(), user, endpoint.permission, endpoint.scope...)
				require.NoError(t, err)
				assert.Equal(t, tc.evalResult, result)
			}
		})
	}
}

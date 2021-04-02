package ossaccesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

func setupTestEnv(t testing.TB) *OSSAccessControlService {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

	ac := overrideAccessControlInRegistry(t, cfg)

	err := ac.Init()
	require.NoError(t, err)
	return &ac
}

func overrideAccessControlInRegistry(t testing.TB, cfg *setting.Cfg) OSSAccessControlService {
	t.Helper()

	ac := OSSAccessControlService{
		Cfg: cfg,
		Log: log.New("accesscontrol-test"),
	}

	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*OSSAccessControlService); ok {
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

type evaluatingPermissionsTestCase struct {
	desc      string
	user      userTestCase
	endpoints []endpointTestCase
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
				orgRole:        models.ROLE_EDITOR,
				isGrafanaAdmin: false,
			},
			endpoints: []endpointTestCase{
				{permission: "users.teams:read", scope: []string{"users:self"}},
				{permission: "users:read", scope: []string{"users:self"}},
			},
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
				assert.True(t, result)
			}
		})
	}
}

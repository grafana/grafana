package authz

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestReadAuthzClientSettingsForcePermissionRoleActionIndex(t *testing.T) {
	tests := []struct {
		name      string
		ini       string
		env       string
		wantForce bool
	}{
		{name: "default disabled", ini: "[authorization]\nmode = inproc\n"},
		{name: "enabled in ini", ini: "[authorization]\nmode = inproc\nforce_permission_role_action_index = true\n", wantForce: true},
		{name: "disabled in ini", ini: "[authorization]\nmode = inproc\nforce_permission_role_action_index = false\n"},
		{name: "environment overrides ini", ini: "[authorization]\nmode = inproc\nforce_permission_role_action_index = false\n", env: "true", wantForce: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.env != "" {
				t.Setenv("GF_AUTHORIZATION_FORCE_PERMISSION_ROLE_ACTION_INDEX", test.env)
			}

			cfg := setting.NewCfg()
			parsed, err := ini.Load([]byte(test.ini))
			require.NoError(t, err)
			cfg.Raw = parsed

			got, err := readAuthzClientSettings(cfg)
			require.NoError(t, err)
			require.Equal(t, clientModeInproc, got.mode)
			require.Equal(t, test.wantForce, got.forcePermissionRoleActionIndex)
		})
	}
}

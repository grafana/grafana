package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestLegacyUserPermissionsShadowMaxConcurrent(t *testing.T) {
	for _, tc := range []struct {
		name  string
		value string
		env   string
		want  int
	}{
		{name: "default", want: 32},
		{name: "custom", value: "8", want: 8},
		{name: "larger", value: "64", want: 64},
		{name: "zero", value: "0", want: 32},
		{name: "negative", value: "-1", want: 32},
		{name: "invalid", value: "invalid", want: 32},
		{name: "environment without defaults entry", env: "12", want: 12},
		{name: "environment overrides file", value: "8", env: "16", want: 16},
		{name: "invalid environment", value: "8", env: "-1", want: 32},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("GF_RBAC_LEGACY_USER_PERMISSIONS_SHADOW_MAX_CONCURRENT", tc.env)
			cfg := NewCfg()
			cfg.Raw = ini.Empty()
			if tc.value != "" {
				cfg.Raw.Section("rbac").Key("legacy_user_permissions_shadow_max_concurrent").SetValue(tc.value)
			}
			cfg.readRBACSettings()
			require.Equal(t, tc.want, cfg.RBAC.LegacyUserPermissionsShadowMaxConcurrent)
		})
	}
}

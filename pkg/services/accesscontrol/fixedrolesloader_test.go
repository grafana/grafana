package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSeedRolesViaLoader(t *testing.T) {
	cfgWithIAM := func(enabled bool) *setting.Cfg {
		cfg := setting.NewCfg()
		sec, err := cfg.Raw.NewSection("rbac.iam_client")
		assert.NoError(t, err)
		if enabled {
			_, err = sec.NewKey("enabled", "true")
		} else {
			_, err = sec.NewKey("enabled", "false")
		}
		assert.NoError(t, err)
		return cfg
	}

	tests := []struct {
		name     string
		features featuremgmt.FeatureToggles
		cfg      *setting.Cfg
		expected bool
	}{
		{
			name:     "toggle off, IAM client not configured",
			features: featuremgmt.WithFeatures(),
			cfg:      setting.NewCfg(),
			expected: false,
		},
		{
			name:     "toggle on, IAM client not configured",
			features: featuremgmt.WithFeatures(featuremgmt.FlagPluginStoreServiceLoading),
			cfg:      setting.NewCfg(),
			expected: true,
		},
		{
			name:     "toggle off, IAM client enabled",
			features: featuremgmt.WithFeatures(),
			cfg:      cfgWithIAM(true),
			expected: true,
		},
		{
			name:     "toggle off, IAM client explicitly disabled",
			features: featuremgmt.WithFeatures(),
			cfg:      cfgWithIAM(false),
			expected: false,
		},
		{
			name:     "toggle on, IAM client enabled",
			features: featuremgmt.WithFeatures(featuremgmt.FlagPluginStoreServiceLoading),
			cfg:      cfgWithIAM(true),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, SeedRolesViaLoader(tt.features, tt.cfg))
		})
	}
}

func TestFixedRolesLoader_IsDisabled(t *testing.T) {
	t.Run("disabled when seeding stays in Server.Init", func(t *testing.T) {
		loader := ProvideFixedRolesLoader(setting.NewCfg(), nil, featuremgmt.WithFeatures())
		assert.True(t, loader.IsDisabled())
	})

	t.Run("enabled when the plugin store service loading toggle is on", func(t *testing.T) {
		loader := ProvideFixedRolesLoader(setting.NewCfg(), nil, featuremgmt.WithFeatures(featuremgmt.FlagPluginStoreServiceLoading))
		assert.False(t, loader.IsDisabled())
	})

	t.Run("enabled when the IAM client is configured", func(t *testing.T) {
		cfg := setting.NewCfg()
		sec, err := cfg.Raw.NewSection("rbac.iam_client")
		assert.NoError(t, err)
		_, err = sec.NewKey("enabled", "true")
		assert.NoError(t, err)

		loader := ProvideFixedRolesLoader(cfg, nil, featuremgmt.WithFeatures())
		assert.False(t, loader.IsDisabled())
	})
}

package setting

import (
	"os"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestFeatureToggles(t *testing.T) {
	testCases := []struct {
		name            string
		conf            map[string]string
		expectedToggles map[string]memprovider.InMemoryFlag
	}{
		{
			name: "can parse feature toggles passed in the `enable` array",
			conf: map[string]string{
				"enable": "feature1,feature2",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": NewInMemoryFlag("feature1", true),
				"feature2": NewInMemoryFlag("feature2", true),
			},
		},
		{
			name: "can parse feature toggles listed under [feature_toggles]",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature3": "true",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": NewInMemoryFlag("feature1", true),
				"feature2": NewInMemoryFlag("feature2", true),
				"feature3": NewInMemoryFlag("feature3", true),
			},
		},
		{
			name: "toggles under [feature_toggles] overrides those in the array",
			conf: map[string]string{
				"enable":   "feature1,feature2",
				"feature2": "false",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": NewInMemoryFlag("feature1", true),
				"feature2": NewInMemoryFlag("feature2", false),
			},
		},
		{
			name: "feature flags of different types are handled correctly",
			conf: map[string]string{
				"feature1": "1", "feature2": "1.0",
				"feature3": `{"foo":"bar"}`, "feature4": "bar",
				"feature5": "t", "feature6": "T",
			},
			expectedToggles: map[string]memprovider.InMemoryFlag{
				"feature1": NewInMemoryFlag("feature1", 1),
				"feature2": NewInMemoryFlag("feature2", 1.0),
				"feature3": NewInMemoryFlag("feature3", map[string]any{"foo": "bar"}),
				"feature4": NewInMemoryFlag("feature4", "bar"),
				"feature5": NewInMemoryFlag("feature5", true),
				"feature6": NewInMemoryFlag("feature6", true),
			},
		},
	}

	for _, tc := range testCases {
		f := ini.Empty()

		toggles, _ := f.NewSection("feature_toggles")
		for k, v := range tc.conf {
			_, err := toggles.NewKey(k, v)
			require.ErrorIs(t, err, nil)
		}

		featureToggles, err := ReadFeatureTogglesFromInitFile(toggles)
		require.NoError(t, err)

		for k, v := range featureToggles {
			toggle := tc.expectedToggles[k]
			require.Equal(t, toggle, v, tc.name)
		}
	}
}

func TestFeatureToggleEnvOverrides(t *testing.T) {
	t.Run("env var creates a feature toggle", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_myFeature", "true")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "true", section.Key("myFeature").Value())
	})

	t.Run("env var overrides ini-defined toggle", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_someToggle", "false")

		cfgFile := t.TempDir() + "/test.ini"
		err := os.WriteFile(cfgFile, []byte("[feature_toggles]\nsomeToggle = true\n"), 0644)
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{HomePath: "../../", Config: cfgFile})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "false", section.Key("someToggle").Value())
	})

	t.Run("camelCase key name is preserved", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_exploreMixedDatasource", "true")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "true", section.Key("exploreMixedDatasource").Value())
		require.False(t, section.HasKey("exploremixeddatasource"), "lowercased key should not exist")
	})

	t.Run("GF_FEATURE_TOGGLES_ENABLE is lowercased to enable", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_ENABLE", "feat1,feat2")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "feat1,feat2", section.Key("enable").Value(),
			"ENABLE env var should map to the lowercase 'enable' ini key")

		// nolint:staticcheck
		require.True(t, cfg.IsFeatureToggleEnabled("feat1"))
		// nolint:staticcheck
		require.True(t, cfg.IsFeatureToggleEnabled("feat2"))
	})

	t.Run("env var is recorded in appliedEnvOverrides", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_coolFeature", "true")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)

		found := false
		for _, o := range cfg.appliedEnvOverrides {
			if strings.Contains(o, "GF_FEATURE_TOGGLES_coolFeature") {
				found = true
				break
			}
		}
		require.True(t, found, "env var should appear in appliedEnvOverrides")
	})

	t.Run("empty env var does not override ini-defined toggle", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_someToggle", "")

		cfgFile := t.TempDir() + "/test.ini"
		err := os.WriteFile(cfgFile, []byte("[feature_toggles]\nsomeToggle = true\n"), 0644)
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{HomePath: "../../", Config: cfgFile})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "true", section.Key("someToggle").Value(),
			"empty env var should not clear the ini-defined value")
	})

	t.Run("underscore in flag name is preserved", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_my_feature", "true")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "true", section.Key("my_feature").Value())
	})

	t.Run("openfeature subsection env vars are not captured as toggles", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_OPENFEATURE_PROVIDER", "ofrep")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)

		// Should be set on the subsection, not the root feature_toggles section.
		ofSection := cfg.Raw.Section("feature_toggles.openfeature")
		require.Equal(t, "ofrep", ofSection.Key("provider").Value())

		// Should NOT appear as a toggle key on the root section.
		ftSection := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "", ftSection.Key("OPENFEATURE_PROVIDER").Value())
	})
}

func TestFeatureToggleCmdOverrides(t *testing.T) {
	t.Run("cfg:feature_toggles.name creates a feature toggle", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:feature_toggles.myToggle=true"},
		})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "true", section.Key("myToggle").Value())
	})

	t.Run("cmd override overrides ini-defined toggle", func(t *testing.T) {
		cfgFile := t.TempDir() + "/test.ini"
		err := os.WriteFile(cfgFile, []byte("[feature_toggles]\nsomeToggle = true\n"), 0644)
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Config:   cfgFile,
			Args:     []string{"cfg:feature_toggles.someToggle=false"},
		})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "false", section.Key("someToggle").Value())
	})

	t.Run("cmd override is recorded in appliedCommandLineProperties", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:feature_toggles.coolFeature=true"},
		})
		require.NoError(t, err)

		found := false
		for _, o := range cfg.appliedCommandLineProperties {
			if strings.Contains(o, "feature_toggles.coolFeature") {
				found = true
				break
			}
		}
		require.True(t, found, "cmd prop should appear in appliedCommandLineProperties")
	})
}

func TestFeatureToggleSourcePrecedence(t *testing.T) {
	t.Run("env var overrides ini file", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_myToggle", "false")

		cfgFile := t.TempDir() + "/test.ini"
		err := os.WriteFile(cfgFile, []byte("[feature_toggles]\nmyToggle = true\n"), 0644)
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{HomePath: "../../", Config: cfgFile})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "false", section.Key("myToggle").Value())
	})

	t.Run("cmd override wins over env var", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_myToggle", "false")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:feature_toggles.myToggle=true"},
		})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "true", section.Key("myToggle").Value(),
			"command line should take precedence over env var")
	})

	t.Run("cmd override wins over both env var and ini file", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_myToggle", "false")

		cfgFile := t.TempDir() + "/test.ini"
		err := os.WriteFile(cfgFile, []byte("[feature_toggles]\nmyToggle = maybe\n"), 0644)
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Config:   cfgFile,
			Args:     []string{"cfg:feature_toggles.myToggle=true"},
		})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.Equal(t, "true", section.Key("myToggle").Value(),
			"command line should take precedence over env var and ini file")
	})

	t.Run("subsection cmd property does not create root toggle key", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:feature_toggles.openfeature.provider=ofrep"},
		})
		require.NoError(t, err)

		section := cfg.Raw.Section("feature_toggles")
		require.False(t, section.HasKey("openfeature.provider"),
			"subsection property should not appear as a root toggle key")
	})
}

func TestFlagValueSerialization(t *testing.T) {
	testCases := []memprovider.InMemoryFlag{
		NewInMemoryFlag("int", 1),
		NewInMemoryFlag("1.0f", 1.0),
		NewInMemoryFlag("1.01f", 1.01),
		NewInMemoryFlag("1.10f", 1.10),
		NewInMemoryFlag("struct", map[string]any{"foo": "bar"}),
		NewInMemoryFlag("string", "bar"),
		NewInMemoryFlag("true", true),
		NewInMemoryFlag("false", false),
	}

	for _, tt := range testCases {
		asStringMap := AsStringMap(map[string]memprovider.InMemoryFlag{tt.Key: tt})

		deserialized, err := ParseFlag(tt.Key, asStringMap[tt.Key])
		assert.NoError(t, err)

		if diff := cmp.Diff(tt, deserialized); diff != "" {
			t.Errorf("(-want, +got) = %v", diff)
		}
	}
}

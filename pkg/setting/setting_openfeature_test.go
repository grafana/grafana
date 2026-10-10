package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

func Test_CtxAttrs(t *testing.T) {
	testCases := []struct {
		name     string
		conf     string
		expected map[string]string
	}{
		{
			name: "empty config - only default attributes should be present",
			expected: map[string]string{
				"grafana_version": "",
				"namespace":       "default",
			},
		},
		{
			name: "config with some attributes",
			conf: `
[feature_toggles.openfeature.context]
foo = bar
baz = qux
quux = corge`,
			expected: map[string]string{
				"foo":             "bar",
				"baz":             "qux",
				"quux":            "corge",
				"grafana_version": "",
				"namespace":       "default",
			},
		},
		{
			name: "config with an attribute that overrides a default one",
			conf: `
[feature_toggles.openfeature.context]
grafana_version = 10.0.0
foo = bar`,
			expected: map[string]string{
				"grafana_version": "10.0.0",
				"foo":             "bar",
				"namespace":       "default",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := NewCfgFromBytes([]byte(tc.conf))
			require.NoError(t, err)

			assert.Equal(t, tc.expected, cfg.OpenFeature.ContextAttrs)
		})
	}
}

func Test_PluginURL(t *testing.T) {
	testCases := []struct {
		name     string
		conf     string
		expected string
	}{
		{
			name: "unset",
		},
		{
			name: "empty value is unset",
			conf: `
[feature_toggles.openfeature]
plugin_url =`,
		},
		{
			name: "http URL with the static provider",
			conf: `
[feature_toggles.openfeature]
provider = static
plugin_url = http://flags.example.com:1031`,
			expected: "http://flags.example.com:1031",
		},
		{
			name: "https URL with a path keeps the path",
			conf: `
[feature_toggles.openfeature]
plugin_url = https://flags.example.com/prefix/`,
			expected: "https://flags.example.com/prefix/",
		},
		{
			name: "set independently of the features-service provider URL",
			conf: `
[feature_toggles.openfeature]
provider = features-service
url = https://features.example.com:6443
plugin_url = http://flags.example.com:1031`,
			expected: "http://flags.example.com:1031",
		},
		{
			name: "set independently of the ofrep provider URL",
			conf: `
[feature_toggles.openfeature]
provider = ofrep
url = http://features.example.com:1031
plugin_url = http://flags.example.com:1031`,
			expected: "http://flags.example.com:1031",
		},
		{
			name: "schemeless value is ignored",
			conf: `
[feature_toggles.openfeature]
plugin_url = flags.example.com`,
		},
		{
			name: "unsupported scheme is ignored",
			conf: `
[feature_toggles.openfeature]
plugin_url = ftp://flags.example.com`,
		},
		{
			name: "missing host is ignored",
			conf: `
[feature_toggles.openfeature]
plugin_url = http://`,
		},
		{
			name: "port without a host is ignored",
			conf: `
[feature_toggles.openfeature]
plugin_url = http://:1031`,
		},
		{
			name: "unparseable value is ignored",
			conf: `
[feature_toggles.openfeature]
plugin_url = http://flags example.com`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := NewCfgFromBytes([]byte(tc.conf))
			require.NoError(t, err)

			if tc.expected == "" {
				assert.Nil(t, cfg.OpenFeature.PluginURL)
				return
			}
			require.NotNil(t, cfg.OpenFeature.PluginURL)
			assert.Equal(t, tc.expected, cfg.OpenFeature.PluginURL.String())
		})
	}
}

func Test_PluginURL_KeepsProviderURL(t *testing.T) {
	cfg, err := NewCfgFromBytes([]byte(`
[feature_toggles.openfeature]
provider = features-service
url = https://features.example.com:6443
plugin_url = http://flags.example.com:1031`))
	require.NoError(t, err)

	assert.Equal(t, FeaturesServiceProviderType, cfg.OpenFeature.ProviderType)
	require.NotNil(t, cfg.OpenFeature.URL)
	assert.Equal(t, "https://features.example.com:6443", cfg.OpenFeature.URL.String())
}

func Test_PluginURL_InvalidValueLogsWarning(t *testing.T) {
	testCases := []struct {
		name  string
		value string
		warns int
	}{
		{name: "valid URL", value: "http://flags.example.com:1031", warns: 0},
		{name: "schemeless", value: "flags.example.com", warns: 1},
		{name: "unsupported scheme", value: "ftp://flags.example.com", warns: 1},
		{name: "missing host", value: "http://", warns: 1},
		{name: "port without a host", value: "http://:1031", warns: 1},
		{name: "unparseable", value: "http://flags example.com", warns: 1},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			f, err := ini.Load([]byte("[feature_toggles.openfeature]\nplugin_url = " + tc.value))
			require.NoError(t, err)

			cfg := NewCfg()
			logger := &logtest.Fake{}
			cfg.Logger = logger
			cfg.Raw = f

			require.NoError(t, cfg.readOpenFeatureSettings())
			assert.Equal(t, tc.warns, logger.WarnLogs.Calls)
		})
	}
}

func Test_PluginURL_Overrides(t *testing.T) {
	t.Run("shipped defaults leave it unset", func(t *testing.T) {
		cfg := NewCfg()
		require.NoError(t, cfg.Load(CommandLineArgs{HomePath: "../../"}))

		assert.Nil(t, cfg.OpenFeature.PluginURL)
		assert.Equal(t, StaticProviderType, cfg.OpenFeature.ProviderType)
	})

	t.Run("environment variable", func(t *testing.T) {
		t.Setenv("GF_FEATURE_TOGGLES_OPENFEATURE_PLUGIN_URL", "http://flags.example.com:1031")

		cfg := NewCfg()
		require.NoError(t, cfg.Load(CommandLineArgs{HomePath: "../../"}))

		require.NotNil(t, cfg.OpenFeature.PluginURL)
		assert.Equal(t, "http://flags.example.com:1031", cfg.OpenFeature.PluginURL.String())
	})

	t.Run("command-line property", func(t *testing.T) {
		cfg := NewCfg()
		require.NoError(t, cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:feature_toggles.openfeature.plugin_url=http://flags.example.com:1031"},
		}))

		require.NotNil(t, cfg.OpenFeature.PluginURL)
		assert.Equal(t, "http://flags.example.com:1031", cfg.OpenFeature.PluginURL.String())
	})
}

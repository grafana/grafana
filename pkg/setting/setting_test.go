package setting

import (
	"bufio"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/osutil"
)

const (
	windows = "windows"
)

func TestLoadingSettings(t *testing.T) {
	skipStaticRootValidation = true

	t.Run("Given the default ini files", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		require.Nil(t, err)

		require.Equal(t, "admin", cfg.AdminUser)
		require.Equal(t, "", cfg.RendererCallbackUrl)
		require.Equal(t, "TLS1.2", cfg.MinTLSVersion)
	})

	t.Run("default.ini should have no semi-colon commented entries", func(t *testing.T) {
		file, err := os.Open("../../conf/defaults.ini")
		if err != nil {
			t.Errorf("failed to load defaults.ini file: %v", err)
		}
		defer func() {
			err := file.Close()
			require.Nil(t, err)
		}()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			// This only catches values commented out with ";" and will not catch those that are commented out with "#".
			if strings.HasPrefix(scanner.Text(), ";") {
				t.Errorf("entries in defaults.ini must not be commented or environment variables will not work: %v", scanner.Text())
			}
		}
	})

	t.Run("sample.ini should load successfully", func(t *testing.T) {
		oldCustomInitPath := customInitPath
		customInitPath = "conf/sample.ini"
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)
		// Restore CustomInitPath to avoid side effects.
		customInitPath = oldCustomInitPath
	})

	t.Run("Should be able to override via environment variables", func(t *testing.T) {
		t.Setenv("GF_SECURITY_ADMIN_USER", "superduper")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		require.Equal(t, "superduper", cfg.AdminUser)
		require.Equal(t, filepath.Join(cfg.HomePath, "data"), cfg.DataPath)
		require.Equal(t, filepath.Join(cfg.DataPath, "log"), cfg.LogsPath)
	})

	t.Run("Should be able to override via plugins.preinstall with GF_INSTALL_PLUGINS env var when GF_PLUGINS_PREINSTALL and cfg.plugins.preinstall are not set", func(t *testing.T) {
		t.Setenv("GF_INSTALL_PLUGINS", "https://grafana.com/grafana/plugins/grafana-piechart-panel/;grafana-piechart-panel")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		require.Equal(t, filepath.Join(cfg.HomePath, "data"), cfg.DataPath)
		require.Equal(t, filepath.Join(cfg.DataPath, "log"), cfg.LogsPath)
		require.Equal(t, cfg.PreinstallPluginsSync, []InstallPlugin{{ID: "grafana-piechart-panel", Version: "", URL: "https://grafana.com/grafana/plugins/grafana-piechart-panel/"}})
	})

	t.Run("Should be able to expand parameter from environment variables", func(t *testing.T) {
		t.Setenv("DEFAULT_IDP_URL", "grafana.com")
		t.Setenv("GF_AUTH_GENERIC_OAUTH_AUTH_URL", "${DEFAULT_IDP_URL}/auth")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		genericOAuthSection, err := cfg.Raw.GetSection("auth.generic_oauth")
		require.NoError(t, err)
		require.Equal(t, "grafana.com/auth", genericOAuthSection.Key("auth_url").Value())
	})

	t.Run("Should replace password when defined in environment", func(t *testing.T) {
		t.Setenv("GF_SECURITY_ADMIN_PASSWORD", "supersecret")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		require.Contains(t, cfg.appliedEnvOverrides, "GF_SECURITY_ADMIN_PASSWORD=*********")
	})

	t.Run("Should replace password in URL when url environment is defined", func(t *testing.T) {
		t.Setenv("GF_DATABASE_URL", "mysql://user:secret@localhost:3306/database")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		require.Contains(t, cfg.appliedEnvOverrides, "GF_DATABASE_URL=mysql://user:xxxxx@localhost:3306/database")
	})

	t.Run("Should create new key from env var when key is not in ini file but section exists", func(t *testing.T) {
		// This tests the fix for the long-standing bug where env vars only worked
		// if the key was already present in defaults.ini or custom.ini.
		t.Setenv("GF_SERVER_MY_CUSTOM_SETTING", "custom_value")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		serverSection, err := cfg.Raw.GetSection("server")
		require.NoError(t, err)
		require.Equal(t, "custom_value", serverSection.Key("my_custom_setting").Value())
		require.Contains(t, cfg.appliedEnvOverrides, "GF_SERVER_MY_CUSTOM_SETTING=custom_value")
	})

	t.Run("Should not create duplicate lowercase key for unified_storage env vars", func(t *testing.T) {
		// unified_storage keys use camelCase (e.g. enableMigration). The generic
		// second pass would lowercase them, creating a duplicate key. These env
		// vars should be skipped in the generic pass and handled only by
		// applyUnifiedStorageEnvOverrides.
		t.Setenv("GF_UNIFIED_STORAGE_DASHBOARDS_DASHBOARD_GRAFANA_APP_ENABLEMIGRATION", "false")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		section, err := cfg.Raw.GetSection("unified_storage.dashboards.dashboard.grafana.app")
		require.NoError(t, err)

		// The correctly-cased key should exist (set by applyUnifiedStorageEnvOverrides).
		require.Equal(t, "false", section.Key("enableMigration").Value())

		// The lowercased key should NOT have been created by the generic second pass.
		require.Equal(t, "", section.Key("enablemigration").Value())

		// Should only appear once in appliedEnvOverrides.
		count := 0
		for _, o := range cfg.appliedEnvOverrides {
			if strings.Contains(o, "GF_UNIFIED_STORAGE_DASHBOARDS_DASHBOARD_GRAFANA_APP_ENABLEMIGRATION") {
				count++
			}
		}
		require.Equal(t, 1, count, "env var should be applied exactly once")
	})

	t.Run("Should match env var to most specific section", func(t *testing.T) {
		// GF_AUTH_GOOGLE_MY_KEY should match [auth.google] not [auth]
		t.Setenv("GF_AUTH_GOOGLE_MY_KEY", "google_value")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		googleSection, err := cfg.Raw.GetSection("auth.google")
		require.NoError(t, err)
		require.Equal(t, "google_value", googleSection.Key("my_key").Value())

		// Verify it did NOT end up in the [auth] section
		authSection, err := cfg.Raw.GetSection("auth")
		require.NoError(t, err)
		require.Equal(t, "", authSection.Key("google_my_key").Value())
	})

	t.Run("Should get property map from command line args array", func(t *testing.T) {
		cfg := NewCfg()
		props := cfg.getCommandLineProperties([]string{"cfg:test=value", "cfg:map.test=1"})

		require.Equal(t, 2, len(props))
		require.Equal(t, "value", props["test"])
		require.Equal(t, "1", props["map.test"])
	})

	t.Run("Should be able to override via command line", func(t *testing.T) {
		if runtime.GOOS == windows {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Args:     []string{`cfg:paths.data=c:\tmp\data`, `cfg:paths.logs=c:\tmp\logs`},
			})
			require.Nil(t, err)
			require.Equal(t, `c:\tmp\data`, cfg.DataPath)
			require.Equal(t, `c:\tmp\logs`, cfg.LogsPath)
		} else {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:paths.data=/tmp/data", "cfg:paths.logs=/tmp/logs"},
			})
			require.Nil(t, err)

			require.Equal(t, "/tmp/data", cfg.DataPath)
			require.Equal(t, "/tmp/logs", cfg.LogsPath)
		}
	})

	t.Run("Should be able to override defaults via command line", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args: []string{
				"cfg:default.server.domain=test2",
			},
			Config: filepath.Join("../../", "pkg/setting/testdata/override.ini"),
		})
		require.Nil(t, err)

		require.Equal(t, "test2", cfg.Domain)
	})

	t.Run("Should be able to override TLS version via command line", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args: []string{
				"cfg:default.server.min_tls_version=TLS1.3",
			},
			Config: filepath.Join("../../", "pkg/setting/testdata/override.ini"),
		})
		require.Nil(t, err)

		require.Equal(t, "TLS1.3", cfg.MinTLSVersion)
	})

	t.Run("Defaults can be overridden in specified config file", func(t *testing.T) {
		if runtime.GOOS == windows {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join("../../", "pkg/setting/testdata/override_windows.ini"),
				Args:     []string{`cfg:default.paths.data=c:\tmp\data`},
			})
			require.Nil(t, err)

			require.Equal(t, `c:\tmp\override`, cfg.DataPath)
		} else {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join("../../", "pkg/setting/testdata/override.ini"),
				Args:     []string{"cfg:default.paths.data=/tmp/data"},
			})
			require.Nil(t, err)

			require.Equal(t, "/tmp/override", cfg.DataPath)
		}
	})

	t.Run("Command line overrides specified config file", func(t *testing.T) {
		if runtime.GOOS == windows {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join("../../", "pkg/setting/testdata/override_windows.ini"),
				Args:     []string{`cfg:paths.data=c:\tmp\data`},
			})
			require.Nil(t, err)

			require.Equal(t, `c:\tmp\data`, cfg.DataPath)
		} else {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join("../../", "pkg/setting/testdata/override.ini"),
				Args:     []string{"cfg:paths.data=/tmp/data"},
			})
			require.Nil(t, err)

			require.Equal(t, "/tmp/data", cfg.DataPath)
		}
	})

	t.Run("Can use environment variables in config values", func(t *testing.T) {
		if runtime.GOOS == windows {
			t.Setenv("GF_DATA_PATH", `c:\tmp\env_override`)
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:paths.data=${GF_DATA_PATH}"},
			})
			require.Nil(t, err)

			require.Equal(t, `c:\tmp\env_override`, cfg.DataPath)
		} else {
			t.Setenv("GF_DATA_PATH", "/tmp/env_override")
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:paths.data=${GF_DATA_PATH}"},
			})
			require.Nil(t, err)

			require.Equal(t, "/tmp/env_override", cfg.DataPath)
		}
	})

	t.Run("instance_name default to hostname even if hostname env is empty", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
		})
		require.Nil(t, err)

		hostname, err := os.Hostname()
		require.Nil(t, err)
		require.Equal(t, hostname, cfg.InstanceName)
	})

	t.Run("Only sync_ttl should return the value sync_ttl", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:auth.proxy.sync_ttl=2"},
		})
		require.Nil(t, err)

		require.Equal(t, 2, cfg.AuthProxy.SyncTTL)
	})

	t.Run("Test reading string values from .ini file", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)
		iniFile, err := ini.Load(path.Join(cfg.HomePath, "pkg/setting/testdata/invalid.ini"))
		require.Nil(t, err)

		t.Run("If key is found - should return value from ini file", func(t *testing.T) {
			value := valueAsString(iniFile.Section("server"), "alt_url", "")
			require.Equal(t, "https://grafana.com/", value)
		})

		t.Run("If key is not found - should return default value", func(t *testing.T) {
			value := valueAsString(iniFile.Section("server"), "extra_url", "default_url_val")
			require.Equal(t, "default_url_val", value)
		})
	})

	t.Run("grafana.com API URL can be set separately from grafana.com URL", func(t *testing.T) {
		t.Setenv("GF_GRAFANA_NET_URL", "https://grafana-dev.com")
		t.Setenv("GF_GRAFANA_COM_API_URL", "http://grafana-dev.internal/api")
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		require.Nil(t, err)
		require.Equal(t, "https://grafana-dev.com", cfg.GrafanaComURL)
		require.Equal(t, "http://grafana-dev.internal/api", cfg.GrafanaComAPIURL)
	})

	t.Run("grafana.com API URL falls back to grafana.com URL + /api", func(t *testing.T) {
		err := os.Unsetenv("GF_GRAFANA_NET_URL")
		require.NoError(t, err)
		err = os.Unsetenv("GF_GRAFANA_COM_API_URL")
		require.NoError(t, err)
		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)
		require.Equal(t, "https://grafana.com", cfg.GrafanaComURL)
		require.Equal(t, "https://grafana.com/api", cfg.GrafanaComAPIURL)
	})

	testProvider := oftesting.NewTestProvider()
	err := openfeature.SetProviderAndWait(testProvider)
	require.NoError(t, err)

	flagEnabled := map[string]memprovider.InMemoryFlag{
		"pluginsDedicatedInstallToken": {
			State:          memprovider.Enabled,
			DefaultVariant: "enabled",
			Variants:       map[string]any{"enabled": true},
		},
	}
	flagDisabled := map[string]memprovider.InMemoryFlag{
		"pluginsDedicatedInstallToken": {
			State:          memprovider.Enabled,
			DefaultVariant: "disabled",
			Variants:       map[string]any{"disabled": false},
		},
	}

	t.Run("PluginInstallToken falls back to sso_api_token when flag is off", func(t *testing.T) {
		defer testProvider.Cleanup()
		testProvider.UsingFlags(t, flagDisabled)
		t.Setenv("GF_GRAFANA_COM_SSO_API_TOKEN", "sso-token")
		t.Setenv("GF_PLUGINS_INSTALL_TOKEN", "dedicated-token")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)
		cfg.ResolvePluginInstallToken()
		require.Equal(t, "sso-token", cfg.PluginInstallToken)
	})

	t.Run("PluginInstallToken uses dedicated token when flag is on and install_token is set", func(t *testing.T) {
		defer testProvider.Cleanup()
		testProvider.UsingFlags(t, flagEnabled)
		t.Setenv("GF_GRAFANA_COM_SSO_API_TOKEN", "sso-token")
		t.Setenv("GF_PLUGINS_INSTALL_TOKEN", "dedicated-token")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)
		cfg.ResolvePluginInstallToken()
		require.Equal(t, "dedicated-token", cfg.PluginInstallToken)
	})

	t.Run("PluginInstallToken falls back to sso_api_token when flag is on but install_token is not set", func(t *testing.T) {
		defer testProvider.Cleanup()
		testProvider.UsingFlags(t, flagEnabled)
		t.Setenv("GF_GRAFANA_COM_SSO_API_TOKEN", "sso-token")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)
		cfg.ResolvePluginInstallToken()
		require.Equal(t, "sso-token", cfg.PluginInstallToken)
	})
}

func TestParseAppURLAndSubURL(t *testing.T) {
	testCases := []struct {
		rootURL           string
		expectedAppURL    string
		expectedAppSubURL string
	}{
		{rootURL: "http://localhost:3000/", expectedAppURL: "http://localhost:3000/"},
		{rootURL: "http://localhost:3000", expectedAppURL: "http://localhost:3000/"},
		{rootURL: "http://localhost:3000/grafana", expectedAppURL: "http://localhost:3000/grafana/", expectedAppSubURL: "/grafana"},
		{rootURL: "http://localhost:3000/grafana/", expectedAppURL: "http://localhost:3000/grafana/", expectedAppSubURL: "/grafana"},
	}

	for _, tc := range testCases {
		f := ini.Empty()
		cfg := NewCfg()
		s, err := f.NewSection("server")
		require.NoError(t, err)
		_, err = s.NewKey("root_url", tc.rootURL)
		require.NoError(t, err)
		appURL, appSubURL, err := cfg.parseAppUrlAndSubUrl(s)
		require.NoError(t, err)
		require.Equal(t, tc.expectedAppURL, appURL)
		require.Equal(t, tc.expectedAppSubURL, appSubURL)
	}
}

func TestAuthDurationSettings(t *testing.T) {
	const maxInactiveDaysTest = 240 * time.Hour

	f := ini.Empty()
	cfg := NewCfg()
	sec, err := f.NewSection("auth")
	require.NoError(t, err)
	_, err = sec.NewKey("login_maximum_inactive_lifetime_duration", "10d")
	require.NoError(t, err)
	err = readAuthSettings(f, cfg)
	require.NoError(t, err)
	require.Equal(t, maxInactiveDaysTest, cfg.LoginMaxInactiveLifetime)

	f = ini.Empty()
	sec, err = f.NewSection("auth")
	require.NoError(t, err)
	_, err = sec.NewKey("login_maximum_inactive_lifetime_duration", "824h")
	require.NoError(t, err)
	maxInactiveDurationTest, err := time.ParseDuration("824h")
	require.NoError(t, err)
	err = readAuthSettings(f, cfg)
	require.NoError(t, err)
	require.Equal(t, maxInactiveDurationTest, cfg.LoginMaxInactiveLifetime)

	f = ini.Empty()
	sec, err = f.NewSection("auth")
	require.NoError(t, err)
	_, err = sec.NewKey("login_maximum_lifetime_duration", "24d")
	require.NoError(t, err)
	maxLifetimeDaysTest, err := time.ParseDuration("576h")
	require.NoError(t, err)
	err = readAuthSettings(f, cfg)
	require.NoError(t, err)
	require.Equal(t, maxLifetimeDaysTest, cfg.LoginMaxLifetime)

	f = ini.Empty()
	sec, err = f.NewSection("auth")
	require.NoError(t, err)
	_, err = sec.NewKey("login_maximum_lifetime_duration", "824h")
	require.NoError(t, err)
	maxLifetimeDurationTest, err := time.ParseDuration("824h")
	require.NoError(t, err)
	err = readAuthSettings(f, cfg)
	require.NoError(t, err)
	require.Equal(t, maxLifetimeDurationTest, cfg.LoginMaxLifetime)

	f = ini.Empty()
	sec, err = f.NewSection("auth")
	require.NoError(t, err)
	_, err = sec.NewKey("login_maximum_lifetime_duration", "")
	require.NoError(t, err)
	maxLifetimeDurationTest, err = time.ParseDuration("720h")
	require.NoError(t, err)
	err = readAuthSettings(f, cfg)
	require.NoError(t, err)
	require.Equal(t, maxLifetimeDurationTest, cfg.LoginMaxLifetime)
}

func TestGetCDNPath(t *testing.T) {
	t.Run("should return CDN url as expected", func(t *testing.T) {
		var (
			err    error
			actual string
		)
		cfg := NewCfg()
		cfg.BuildVersion = "v7.5.0-11124"
		cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com")
		require.NoError(t, err)

		actual, err = cfg.GetContentDeliveryURL("grafana-oss")
		require.NoError(t, err)
		require.Equal(t, "http://cdn.grafana.com/grafana-oss/v7.5.0-11124/", actual)
		actual, err = cfg.GetContentDeliveryURL("grafana")
		require.NoError(t, err)
		require.Equal(t, "http://cdn.grafana.com/grafana/v7.5.0-11124/", actual)
	})

	t.Run("should error if BuildVersion  is not set", func(t *testing.T) {
		var err error
		cfg := NewCfg()
		cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com")
		require.NoError(t, err)

		_, err = cfg.GetContentDeliveryURL("grafana")
		require.Error(t, err)
	})
}

func TestGetCDNPathWithPreReleaseVersionAndSubPath(t *testing.T) {
	var err error
	cfg := NewCfg()
	cfg.BuildVersion = "v7.5.0-11124pre"
	cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com/sub")
	require.NoError(t, err)
	actual, err := cfg.GetContentDeliveryURL("grafana-oss")
	require.NoError(t, err)
	require.Equal(t, "http://cdn.grafana.com/sub/grafana-oss/v7.5.0-11124pre/", actual)
	actual, err = cfg.GetContentDeliveryURL("grafana")
	require.NoError(t, err)
	require.Equal(t, "http://cdn.grafana.com/sub/grafana/v7.5.0-11124pre/", actual)
}

// Adding a case for this in case we switch to proper semver version strings
func TestGetCDNPathWithAlphaVersion(t *testing.T) {
	var err error
	cfg := NewCfg()
	cfg.BuildVersion = "v7.5.0-alpha.11124"
	cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com")
	require.NoError(t, err)
	actual, err := cfg.GetContentDeliveryURL("grafana-oss")
	require.NoError(t, err)
	require.Equal(t, "http://cdn.grafana.com/grafana-oss/v7.5.0-alpha.11124/", actual)
	actual, err = cfg.GetContentDeliveryURL("grafana")
	require.NoError(t, err)
	require.Equal(t, "http://cdn.grafana.com/grafana/v7.5.0-alpha.11124/", actual)
}

func TestAlertingEnabled(t *testing.T) {
	t.Run("fail if legacy alerting enabled", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()

		alertingSec, err := f.NewSection("alerting")
		require.NoError(t, err)
		_, err = alertingSec.NewKey("enabled", "true")
		require.NoError(t, err)

		require.Error(t, cfg.readAlertingSettings(f))
	})

	t.Run("do nothing if it is disabled", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()

		alertingSec, err := f.NewSection("alerting")
		require.NoError(t, err)
		_, err = alertingSec.NewKey("enabled", "false")
		require.NoError(t, err)
		require.NoError(t, cfg.readAlertingSettings(f))
	})

	t.Run("do nothing if it invalid", func(t *testing.T) {
		f := ini.Empty()
		cfg := NewCfg()

		alertingSec, err := f.NewSection("alerting")
		require.NoError(t, err)
		_, err = alertingSec.NewKey("enabled", "test")
		require.NoError(t, err)
		require.NoError(t, cfg.readAlertingSettings(f))
	})
}

func TestRedactedValue(t *testing.T) {
	testCases := []struct {
		desc     string
		key      string
		value    string
		expected string
	}{
		{
			desc:     "non-sensitive key",
			key:      "admin_user",
			value:    "admin",
			expected: "admin",
		},
		{
			desc:     "sensitive key with non-empty value",
			key:      "private_key_path",
			value:    "/path/to/key",
			expected: RedactedPassword,
		},
		{
			desc:     "license key with non-empty value",
			key:      "GF_ENTERPRISE_LICENSE_TEXT",
			value:    "some_license_key_test",
			expected: RedactedPassword,
		},
		{
			desc:     "sensitive key with empty value",
			key:      "private_key_path",
			value:    "",
			expected: "",
		},
		{
			desc:     "authentication_token",
			key:      "my_authentication_token",
			value:    "test",
			expected: RedactedPassword,
		},
		{
			desc:     "client token",
			key:      "token",
			value:    "test",
			expected: RedactedPassword,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.expected, RedactedValue(tc.key, tc.value))
		})
	}
}

func TestHandleAWSSettings(t *testing.T) {
	t.Run("Should set default auth providers if not defined", func(t *testing.T) {
		cfg := NewCfg()
		awsSection, err := cfg.Raw.NewSection("aws")
		require.NoError(t, err)
		_, err = awsSection.NewKey("allowed_auth_providers", "")
		require.NoError(t, err)

		cfg.handleAWSConfig()
		assert.Equal(t, []string{"default", "keys", "credentials"}, cfg.AWSAllowedAuthProviders)
	})
	t.Run("Should pass on auth providers defined in config", func(t *testing.T) {
		cfg := NewCfg()
		awsSection, err := cfg.Raw.NewSection("aws")
		require.NoError(t, err)
		_, err = awsSection.NewKey("allowed_auth_providers", "keys, credentials")
		require.NoError(t, err)

		cfg.handleAWSConfig()
		assert.Equal(t, []string{"keys", "credentials"}, cfg.AWSAllowedAuthProviders)
	})
	t.Run("Should set assume role to true if not defined", func(t *testing.T) {
		cfg := NewCfg()
		awsSection, err := cfg.Raw.NewSection("aws")
		require.NoError(t, err)
		_, err = awsSection.NewKey("assume_role_enabled", "")
		require.NoError(t, err)

		cfg.handleAWSConfig()
		assert.Equal(t, true, cfg.AWSAssumeRoleEnabled)
	})
	t.Run("Should set assume role to true if defined as true in the config", func(t *testing.T) {
		cfg := NewCfg()
		awsSection, err := cfg.Raw.NewSection("aws")
		require.NoError(t, err)
		_, err = awsSection.NewKey("assume_role_enabled", "true")
		require.NoError(t, err)

		cfg.handleAWSConfig()
		assert.Equal(t, true, cfg.AWSAssumeRoleEnabled)
	})
	t.Run("Should set assume role to false if defined as false in the config", func(t *testing.T) {
		cfg := NewCfg()
		awsSection, err := cfg.Raw.NewSection("aws")
		require.NoError(t, err)
		_, err = awsSection.NewKey("assume_role_enabled", "false")
		require.NoError(t, err)

		cfg.handleAWSConfig()
		assert.Equal(t, false, cfg.AWSAssumeRoleEnabled)
	})
	t.Run("Should set default page limit if not defined", func(t *testing.T) {
		cfg := NewCfg()
		awsSection, err := cfg.Raw.NewSection("aws")
		require.NoError(t, err)
		_, err = awsSection.NewKey("list_metrics_page_limit", "")
		require.NoError(t, err)

		cfg.handleAWSConfig()

		assert.Equal(t, 500, cfg.AWSListMetricsPageLimit)
	})
	t.Run("Should pass on the limit if it is defined in the config", func(t *testing.T) {
		cfg := NewCfg()
		awsSection, err := cfg.Raw.NewSection("aws")
		require.NoError(t, err)
		_, err = awsSection.NewKey("list_metrics_page_limit", "400")
		require.NoError(t, err)

		cfg.handleAWSConfig()

		assert.Equal(t, 400, cfg.AWSListMetricsPageLimit)
	})
}

const iniString = `
app_mode = production

[server]
domain = test.com
`

func TestNewCfgFromBytes(t *testing.T) {
	cfg, err := NewCfgFromBytes([]byte(iniString))
	require.NoError(t, err)
	require.NotNil(t, cfg)
	require.Equal(t, Prod, cfg.Env)
	require.Equal(t, "test.com", cfg.Domain)
}

func TestNewCfgFromINIFile(t *testing.T) {
	parsedFile, err := ini.Load([]byte(iniString))
	require.NoError(t, err)
	require.NotNil(t, parsedFile)

	cfg, err := NewCfgFromINIFile(parsedFile)
	require.NoError(t, err)
	require.NotNil(t, cfg)
	require.Equal(t, Prod, cfg.Env)
	require.Equal(t, "test.com", cfg.Domain)
}

func TestDynamicSection(t *testing.T) {
	t.Parallel()

	t.Run("repro #44509 - panic on concurrent map write", func(t *testing.T) {
		t.Parallel()

		const (
			goroutines = 10
			attempts   = 1000
			section    = "DEFAULT"
			key        = "TestDynamicSection_repro_44509"
			value      = "theval"
		)

		cfg, err := NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		ds := &DynamicSection{
			section: cfg.Raw.Section(section),
			Logger:  log.NewNopLogger(),
			env:     osutil.MapEnv{},
		}
		osVar := EnvKey(section, key)
		err = ds.env.Setenv(osVar, value)
		require.NoError(t, err)

		var wg sync.WaitGroup
		for i := 0; i < goroutines; i++ {
			wg.Add(1)
			go require.NotPanics(t, func() {
				for i := 0; i < attempts; i++ {
					ds.section.Key(key).SetValue("")
					ds.Key(key)
				}
				wg.Done()
			})
		}
		wg.Wait()

		assert.Equal(t, value, ds.section.Key(key).String())
	})
}

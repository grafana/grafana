package setting

import (
	"bufio"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gopkg.in/ini.v1"
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
		require.Equal(t, "http://localhost:3000/", cfg.RendererCallbackUrl)
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
		customInitPath := CustomInitPath
		CustomInitPath = "conf/sample.ini"
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)
		// Restore CustomInitPath to avoid side effects.
		CustomInitPath = customInitPath
	})

	t.Run("Should be able to override via environment variables", func(t *testing.T) {
		err := os.Setenv("GF_SECURITY_ADMIN_USER", "superduper")
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		require.Equal(t, "superduper", cfg.AdminUser)
		require.Equal(t, filepath.Join(HomePath, "data"), cfg.DataPath)
		require.Equal(t, filepath.Join(cfg.DataPath, "log"), cfg.LogsPath)
	})

	t.Run("Should replace password when defined in environment", func(t *testing.T) {
		err := os.Setenv("GF_SECURITY_ADMIN_PASSWORD", "supersecret")
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		require.Contains(t, appliedEnvOverrides, "GF_SECURITY_ADMIN_PASSWORD=*********")
	})

	t.Run("Should replace password in URL when url environment is defined", func(t *testing.T) {
		err := os.Setenv("GF_DATABASE_URL", "mysql://user:secret@localhost:3306/database")
		require.NoError(t, err)

		cfg := NewCfg()
		err = cfg.Load(CommandLineArgs{HomePath: "../../"})
		require.Nil(t, err)

		require.Contains(t, appliedEnvOverrides, "GF_DATABASE_URL=mysql://user:xxxxx@localhost:3306/database")
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
			Config: filepath.Join(HomePath, "pkg/setting/testdata/override.ini"),
		})
		require.Nil(t, err)

		require.Equal(t, "test2", cfg.Domain)
	})

	t.Run("Defaults can be overridden in specified config file", func(t *testing.T) {
		if runtime.GOOS == windows {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join(HomePath, "pkg/setting/testdata/override_windows.ini"),
				Args:     []string{`cfg:default.paths.data=c:\tmp\data`},
			})
			require.Nil(t, err)

			require.Equal(t, `c:\tmp\override`, cfg.DataPath)
		} else {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join(HomePath, "pkg/setting/testdata/override.ini"),
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
				Config:   filepath.Join(HomePath, "pkg/setting/testdata/override_windows.ini"),
				Args:     []string{`cfg:paths.data=c:\tmp\data`},
			})
			require.Nil(t, err)

			require.Equal(t, `c:\tmp\data`, cfg.DataPath)
		} else {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Config:   filepath.Join(HomePath, "pkg/setting/testdata/override.ini"),
				Args:     []string{"cfg:paths.data=/tmp/data"},
			})
			require.Nil(t, err)

			require.Equal(t, "/tmp/data", cfg.DataPath)
		}
	})

	t.Run("Can use environment variables in config values", func(t *testing.T) {
		if runtime.GOOS == windows {
			err := os.Setenv("GF_DATA_PATH", `c:\tmp\env_override`)
			require.NoError(t, err)
			cfg := NewCfg()
			err = cfg.Load(CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:paths.data=${GF_DATA_PATH}"},
			})
			require.Nil(t, err)

			require.Equal(t, `c:\tmp\env_override`, cfg.DataPath)
		} else {
			err := os.Setenv("GF_DATA_PATH", "/tmp/env_override")
			require.NoError(t, err)
			cfg := NewCfg()
			err = cfg.Load(CommandLineArgs{
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
		require.Equal(t, hostname, InstanceName)
	})

	t.Run("Reading callback_url should add trailing slash", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:rendering.callback_url=http://myserver/renderer"},
		})
		require.Nil(t, err)

		require.Equal(t, "http://myserver/renderer/", cfg.RendererCallbackUrl)
	})

	t.Run("Only sync_ttl should return the value sync_ttl", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:auth.proxy.sync_ttl=2"},
		})
		require.Nil(t, err)

		require.Equal(t, 2, cfg.AuthProxySyncTTL)
	})

	t.Run("Only ldap_sync_ttl should return the value ldap_sync_ttl", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:auth.proxy.ldap_sync_ttl=5"},
		})
		require.Nil(t, err)

		require.Equal(t, 5, cfg.AuthProxySyncTTL)
	})

	t.Run("ldap_sync should override ldap_sync_ttl that is default value", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:auth.proxy.sync_ttl=5"},
		})
		require.Nil(t, err)

		require.Equal(t, 5, cfg.AuthProxySyncTTL)
	})

	t.Run("ldap_sync should not override ldap_sync_ttl that is different from default value", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{
			HomePath: "../../",
			Args:     []string{"cfg:auth.proxy.ldap_sync_ttl=12", "cfg:auth.proxy.sync_ttl=5"},
		})
		require.Nil(t, err)

		require.Equal(t, 12, cfg.AuthProxySyncTTL)
	})

	t.Run("Test reading string values from .ini file", func(t *testing.T) {
		iniFile, err := ini.Load(path.Join(HomePath, "pkg/setting/testdata/invalid.ini"))
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
	_, err = sec.NewKey("login_maximum_inactive_lifetime_days", "10")
	require.NoError(t, err)
	_, err = sec.NewKey("login_maximum_inactive_lifetime_duration", "")
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
	_, err = sec.NewKey("login_maximum_lifetime_days", "24")
	require.NoError(t, err)
	_, err = sec.NewKey("login_maximum_lifetime_duration", "")
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
	_, err = sec.NewKey("login_maximum_lifetime_days", "")
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
	var err error
	cfg := NewCfg()
	cfg.BuildVersion = "v7.5.0-11124"
	cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com")
	require.NoError(t, err)

	require.Equal(t, "http://cdn.grafana.com/grafana-oss/v7.5.0-11124/", cfg.GetContentDeliveryURL("grafana-oss"))
	require.Equal(t, "http://cdn.grafana.com/grafana/v7.5.0-11124/", cfg.GetContentDeliveryURL("grafana"))
}

func TestGetContentDeliveryURLWhenNoCDNRootURLIsSet(t *testing.T) {
	cfg := NewCfg()
	require.Equal(t, "", cfg.GetContentDeliveryURL("grafana-oss"))
}

func TestGetCDNPathWithPreReleaseVersionAndSubPath(t *testing.T) {
	var err error
	cfg := NewCfg()
	cfg.BuildVersion = "v7.5.0-11124pre"
	cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com/sub")
	require.NoError(t, err)
	require.Equal(t, "http://cdn.grafana.com/sub/grafana-oss/v7.5.0-11124pre/", cfg.GetContentDeliveryURL("grafana-oss"))
	require.Equal(t, "http://cdn.grafana.com/sub/grafana/v7.5.0-11124pre/", cfg.GetContentDeliveryURL("grafana"))
}

// Adding a case for this in case we switch to proper semver version strings
func TestGetCDNPathWithAlphaVersion(t *testing.T) {
	var err error
	cfg := NewCfg()
	cfg.BuildVersion = "v7.5.0-alpha.11124"
	cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com")
	require.NoError(t, err)
	require.Equal(t, "http://cdn.grafana.com/grafana-oss/v7.5.0-alpha.11124/", cfg.GetContentDeliveryURL("grafana-oss"))
	require.Equal(t, "http://cdn.grafana.com/grafana/v7.5.0-alpha.11124/", cfg.GetContentDeliveryURL("grafana"))
}

func TestAlertingEnabled(t *testing.T) {
	testCases := []struct {
		desc                   string
		unifiedAlertingEnabled string
		legacyAlertingEnabled  string
		featureToggleSet       bool
		verifyCfg              func(*testing.T, Cfg, *ini.File)
	}{
		{
			desc:                   "when legacy alerting is enabled and unified is disabled",
			legacyAlertingEnabled:  "true",
			unifiedAlertingEnabled: "false",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, false)
				assert.Equal(t, AlertingEnabled, true)
			},
		},
		{
			desc:                   "when legacy alerting is disabled and unified is enabled",
			legacyAlertingEnabled:  "false",
			unifiedAlertingEnabled: "true",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, true)
				assert.Equal(t, AlertingEnabled, false)
			},
		},
		{
			desc:                   "when both alerting are enabled, it should error",
			legacyAlertingEnabled:  "true",
			unifiedAlertingEnabled: "true",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.Error(t, err)
			},
		},
		{
			desc:                   "when legacy alerting is invalid and unified is disabled",
			legacyAlertingEnabled:  "invalid",
			unifiedAlertingEnabled: "false",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, false)
				assert.Equal(t, AlertingEnabled, true)
			},
		},
		{
			desc:                   "when legacy alerting is invalid and unified is enabled",
			legacyAlertingEnabled:  "invalid",
			unifiedAlertingEnabled: "true",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.Error(t, err)
			},
		},
		{
			desc:                   "when legacy alerting is enabled and unified is invalid",
			legacyAlertingEnabled:  "true",
			unifiedAlertingEnabled: "invalid",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, false)
				assert.Equal(t, AlertingEnabled, true)
			},
		},
		{
			desc:                   "when legacy alerting is disabled and unified is invalid",
			legacyAlertingEnabled:  "false",
			unifiedAlertingEnabled: "invalid",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, false)
				assert.Equal(t, AlertingEnabled, false)
			},
		},
		{
			desc:                   "when both are invalid",
			legacyAlertingEnabled:  "invalid",
			unifiedAlertingEnabled: "invalid",
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, false)
				assert.Equal(t, AlertingEnabled, true)
			},
		},
		{
			desc:                   "when legacy alerting is enabled and unified is disabled and feature toggle is set",
			legacyAlertingEnabled:  "true",
			unifiedAlertingEnabled: "false",
			featureToggleSet:       true,
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, true)
				assert.Equal(t, AlertingEnabled, false)
			},
		},
		{
			desc:                   "when legacy alerting is disabled and unified is disabled and feature toggle is set",
			legacyAlertingEnabled:  "false",
			unifiedAlertingEnabled: "false",
			featureToggleSet:       true,
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, true)
				assert.Equal(t, AlertingEnabled, false)
			},
		},
		{
			desc:                   "when legacy alerting is disabled and unified is invalid and feature toggle is set",
			legacyAlertingEnabled:  "false",
			unifiedAlertingEnabled: "invalid",
			featureToggleSet:       true,
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, true)
				assert.Equal(t, AlertingEnabled, false)
			},
		},
		{
			desc:                   "when legacy alerting is invalid and unified is disabled and feature toggle is set",
			legacyAlertingEnabled:  "invalid",
			unifiedAlertingEnabled: "false",
			featureToggleSet:       true,
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, true)
				assert.Equal(t, AlertingEnabled, false)
			},
		},
		{
			desc:                   "when legacy alerting is invalid and unified is enabled and feature toggle is set",
			legacyAlertingEnabled:  "invalid",
			unifiedAlertingEnabled: "true",
			featureToggleSet:       true,
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.Error(t, err)
			},
		},
		{
			desc:                   "when both are invalid and feature toggle is set",
			legacyAlertingEnabled:  "invalid",
			unifiedAlertingEnabled: "invalid",
			featureToggleSet:       true,
			verifyCfg: func(t *testing.T, cfg Cfg, f *ini.File) {
				err := readAlertingSettings(f)
				require.NoError(t, err)
				err = cfg.readFeatureToggles(f)
				require.NoError(t, err)
				err = cfg.ReadUnifiedAlertingSettings(f)
				require.NoError(t, err)
				assert.Equal(t, cfg.UnifiedAlerting.Enabled, true)
				assert.Equal(t, AlertingEnabled, false)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			t.Cleanup(func() {
				AlertingEnabled = false
			})

			f := ini.Empty()
			cfg := NewCfg()
			unifiedAlertingSec, err := f.NewSection("unified_alerting")
			require.NoError(t, err)
			_, err = unifiedAlertingSec.NewKey("enabled", tc.unifiedAlertingEnabled)
			require.NoError(t, err)

			alertingSec, err := f.NewSection("alerting")
			require.NoError(t, err)
			_, err = alertingSec.NewKey("enabled", tc.legacyAlertingEnabled)
			require.NoError(t, err)

			if tc.featureToggleSet {
				alertingSec, err := f.NewSection("feature_toggles")
				require.NoError(t, err)
				_, err = alertingSec.NewKey("enable", "ngalert")
				require.NoError(t, err)
			}

			tc.verifyCfg(t, *cfg, f)
		})
	}
}

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

	"github.com/stretchr/testify/require"

	"gopkg.in/ini.v1"

	. "github.com/smartystreets/goconvey/convey"
)

const (
	windows = "windows"
)

func TestLoadingSettings(t *testing.T) {
	Convey("Testing loading settings from ini file", t, func() {
		skipStaticRootValidation = true

		Convey("Given the default ini files", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
			So(err, ShouldBeNil)

			So(cfg.AdminUser, ShouldEqual, "admin")
			So(cfg.RendererCallbackUrl, ShouldEqual, "http://localhost:3000/")
		})

		Convey("default.ini should have no semi-colon commented entries", func() {
			file, err := os.Open("../../conf/defaults.ini")
			if err != nil {
				t.Errorf("failed to load defaults.ini file: %v", err)
			}
			defer func() {
				err := file.Close()
				So(err, ShouldBeNil)
			}()

			scanner := bufio.NewScanner(file)
			for scanner.Scan() {
				// This only catches values commented out with ";" and will not catch those that are commented out with "#".
				if strings.HasPrefix(scanner.Text(), ";") {
					t.Errorf("entries in defaults.ini must not be commented or environment variables will not work: %v", scanner.Text())
				}
			}
		})

		Convey("Should be able to override via environment variables", func() {
			err := os.Setenv("GF_SECURITY_ADMIN_USER", "superduper")
			require.NoError(t, err)

			cfg := NewCfg()
			err = cfg.Load(&CommandLineArgs{HomePath: "../../"})
			So(err, ShouldBeNil)

			So(cfg.AdminUser, ShouldEqual, "superduper")
			So(cfg.DataPath, ShouldEqual, filepath.Join(HomePath, "data"))
			So(cfg.LogsPath, ShouldEqual, filepath.Join(cfg.DataPath, "log"))
		})

		Convey("Should replace password when defined in environment", func() {
			err := os.Setenv("GF_SECURITY_ADMIN_PASSWORD", "supersecret")
			require.NoError(t, err)

			cfg := NewCfg()
			err = cfg.Load(&CommandLineArgs{HomePath: "../../"})
			So(err, ShouldBeNil)

			So(appliedEnvOverrides, ShouldContain, "GF_SECURITY_ADMIN_PASSWORD=*********")
		})

		Convey("Should replace password in URL when url environment is defined", func() {
			err := os.Setenv("GF_DATABASE_URL", "mysql://user:secret@localhost:3306/database")
			require.NoError(t, err)

			cfg := NewCfg()
			err = cfg.Load(&CommandLineArgs{HomePath: "../../"})
			So(err, ShouldBeNil)

			So(appliedEnvOverrides, ShouldContain, "GF_DATABASE_URL=mysql://user:xxxxx@localhost:3306/database")
		})

		Convey("Should get property map from command line args array", func() {
			props := getCommandLineProperties([]string{"cfg:test=value", "cfg:map.test=1"})

			So(len(props), ShouldEqual, 2)
			So(props["test"], ShouldEqual, "value")
			So(props["map.test"], ShouldEqual, "1")
		})

		Convey("Should be able to override via command line", func() {
			if runtime.GOOS == windows {
				cfg := NewCfg()
				err := cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Args:     []string{`cfg:paths.data=c:\tmp\data`, `cfg:paths.logs=c:\tmp\logs`},
				})
				So(err, ShouldBeNil)
				So(cfg.DataPath, ShouldEqual, `c:\tmp\data`)
				So(cfg.LogsPath, ShouldEqual, `c:\tmp\logs`)
			} else {
				cfg := NewCfg()
				err := cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Args:     []string{"cfg:paths.data=/tmp/data", "cfg:paths.logs=/tmp/logs"},
				})
				So(err, ShouldBeNil)

				So(cfg.DataPath, ShouldEqual, "/tmp/data")
				So(cfg.LogsPath, ShouldEqual, "/tmp/logs")
			}
		})

		Convey("Should be able to override defaults via command line", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{
				HomePath: "../../",
				Args: []string{
					"cfg:default.server.domain=test2",
				},
				Config: filepath.Join(HomePath, "pkg/setting/testdata/override.ini"),
			})
			So(err, ShouldBeNil)

			So(cfg.Domain, ShouldEqual, "test2")
		})

		Convey("Defaults can be overridden in specified config file", func() {
			if runtime.GOOS == windows {
				cfg := NewCfg()
				err := cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Config:   filepath.Join(HomePath, "pkg/setting/testdata/override_windows.ini"),
					Args:     []string{`cfg:default.paths.data=c:\tmp\data`},
				})
				So(err, ShouldBeNil)

				So(cfg.DataPath, ShouldEqual, `c:\tmp\override`)
			} else {
				cfg := NewCfg()
				err := cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Config:   filepath.Join(HomePath, "pkg/setting/testdata/override.ini"),
					Args:     []string{"cfg:default.paths.data=/tmp/data"},
				})
				So(err, ShouldBeNil)

				So(cfg.DataPath, ShouldEqual, "/tmp/override")
			}
		})

		Convey("Command line overrides specified config file", func() {
			if runtime.GOOS == windows {
				cfg := NewCfg()
				err := cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Config:   filepath.Join(HomePath, "pkg/setting/testdata/override_windows.ini"),
					Args:     []string{`cfg:paths.data=c:\tmp\data`},
				})
				So(err, ShouldBeNil)

				So(cfg.DataPath, ShouldEqual, `c:\tmp\data`)
			} else {
				cfg := NewCfg()
				err := cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Config:   filepath.Join(HomePath, "pkg/setting/testdata/override.ini"),
					Args:     []string{"cfg:paths.data=/tmp/data"},
				})
				So(err, ShouldBeNil)

				So(cfg.DataPath, ShouldEqual, "/tmp/data")
			}
		})

		Convey("Can use environment variables in config values", func() {
			if runtime.GOOS == windows {
				err := os.Setenv("GF_DATA_PATH", `c:\tmp\env_override`)
				require.NoError(t, err)
				cfg := NewCfg()
				err = cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Args:     []string{"cfg:paths.data=${GF_DATA_PATH}"},
				})
				So(err, ShouldBeNil)

				So(cfg.DataPath, ShouldEqual, `c:\tmp\env_override`)
			} else {
				err := os.Setenv("GF_DATA_PATH", "/tmp/env_override")
				require.NoError(t, err)
				cfg := NewCfg()
				err = cfg.Load(&CommandLineArgs{
					HomePath: "../../",
					Args:     []string{"cfg:paths.data=${GF_DATA_PATH}"},
				})
				So(err, ShouldBeNil)

				So(cfg.DataPath, ShouldEqual, "/tmp/env_override")
			}
		})

		Convey("instance_name default to hostname even if hostname env is empty", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{
				HomePath: "../../",
			})
			So(err, ShouldBeNil)

			hostname, err := os.Hostname()
			So(err, ShouldBeNil)
			So(InstanceName, ShouldEqual, hostname)
		})

		Convey("Reading callback_url should add trailing slash", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:rendering.callback_url=http://myserver/renderer"},
			})
			So(err, ShouldBeNil)

			So(cfg.RendererCallbackUrl, ShouldEqual, "http://myserver/renderer/")
		})

		Convey("Only sync_ttl should return the value sync_ttl", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:auth.proxy.sync_ttl=2"},
			})
			So(err, ShouldBeNil)

			So(cfg.AuthProxySyncTTL, ShouldEqual, 2)
		})

		Convey("Only ldap_sync_ttl should return the value ldap_sync_ttl", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:auth.proxy.ldap_sync_ttl=5"},
			})
			So(err, ShouldBeNil)

			So(cfg.AuthProxySyncTTL, ShouldEqual, 5)
		})

		Convey("ldap_sync should override ldap_sync_ttl that is default value", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:auth.proxy.sync_ttl=5"},
			})
			So(err, ShouldBeNil)

			So(cfg.AuthProxySyncTTL, ShouldEqual, 5)
		})

		Convey("ldap_sync should not override ldap_sync_ttl that is different from default value", func() {
			cfg := NewCfg()
			err := cfg.Load(&CommandLineArgs{
				HomePath: "../../",
				Args:     []string{"cfg:auth.proxy.ldap_sync_ttl=12", "cfg:auth.proxy.sync_ttl=5"},
			})
			So(err, ShouldBeNil)

			So(cfg.AuthProxySyncTTL, ShouldEqual, 12)
		})
	})

	Convey("Test reading string values from .ini file", t, func() {
		iniFile, err := ini.Load(path.Join(HomePath, "pkg/setting/testdata/invalid.ini"))
		So(err, ShouldBeNil)

		Convey("If key is found - should return value from ini file", func() {
			value := valueAsString(iniFile.Section("server"), "alt_url", "")
			So(value, ShouldEqual, "https://grafana.com/")
		})

		Convey("If key is not found - should return default value", func() {
			value := valueAsString(iniFile.Section("server"), "extra_url", "default_url_val")
			So(value, ShouldEqual, "default_url_val")
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
		s, err := f.NewSection("server")
		require.NoError(t, err)
		_, err = s.NewKey("root_url", tc.rootURL)
		require.NoError(t, err)
		appURL, appSubURL, err := parseAppUrlAndSubUrl(s)
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
	require.Equal(t, "http://cdn.grafana.com/sub/grafana-oss/pre-releases/v7.5.0-11124pre/", cfg.GetContentDeliveryURL("grafana-oss"))
	require.Equal(t, "http://cdn.grafana.com/sub/grafana/pre-releases/v7.5.0-11124pre/", cfg.GetContentDeliveryURL("grafana"))
}

// Adding a case for this in case we switch to proper semver version strings
func TestGetCDNPathWithAlphaVersion(t *testing.T) {
	var err error
	cfg := NewCfg()
	cfg.BuildVersion = "v7.5.0-alpha.11124"
	cfg.CDNRootURL, err = url.Parse("http://cdn.grafana.com")
	require.NoError(t, err)
	require.Equal(t, "http://cdn.grafana.com/grafana-oss/pre-releases/v7.5.0-alpha.11124/", cfg.GetContentDeliveryURL("grafana-oss"))
	require.Equal(t, "http://cdn.grafana.com/grafana/pre-releases/v7.5.0-alpha.11124/", cfg.GetContentDeliveryURL("grafana"))
}

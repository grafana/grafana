package testinfra

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// StartGrafana starts a Grafana server.
// The server address is returned.
func StartGrafana(t *testing.T, grafDir, cfgPath string) (string, *sqlstore.SQLStore) {
	addr, env := StartGrafanaEnv(t, grafDir, cfgPath)
	return addr, env.SQLStore
}

func StartGrafanaEnv(t *testing.T, grafDir, cfgPath string) (string, *server.TestEnv) {
	t.Helper()
	ctx := context.Background()

	setting.IsEnterprise = extensions.IsEnterprise
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	cmdLineArgs := setting.CommandLineArgs{Config: cfgPath, HomePath: grafDir}
	serverOpts := server.Options{Listener: listener, HomePath: grafDir}
	apiServerOpts := api.ServerOptions{Listener: listener}

	env, err := server.InitializeForTest(cmdLineArgs, serverOpts, apiServerOpts)
	require.NoError(t, err)
	require.NoError(t, env.SQLStore.Sync())

	go func() {
		// When the server runs, it will also build and initialize the service graph
		if err := env.Server.Run(); err != nil {
			t.Log("Server exited uncleanly", "error", err)
		}
	}()
	t.Cleanup(func() {
		if err := env.Server.Shutdown(ctx, "test cleanup"); err != nil {
			t.Error("Timed out waiting on server to shut down")
		}
	})

	// Wait for Grafana to be ready
	addr := listener.Addr().String()
	resp, err := http.Get(fmt.Sprintf("http://%s/api/health", addr))
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() {
		err := resp.Body.Close()
		assert.NoError(t, err)
	})
	require.Equal(t, 200, resp.StatusCode)

	t.Logf("Grafana is listening on %s", addr)

	return addr, env
}

// SetUpDatabase sets up the Grafana database.
func SetUpDatabase(t *testing.T, grafDir string) *sqlstore.SQLStore {
	t.Helper()

	sqlStore := sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{
		EnsureDefaultOrgAndUser: true,
	})
	// We need the main org, since it's used for anonymous access
	org, err := sqlStore.GetOrgByName(sqlstore.MainOrgName)
	require.NoError(t, err)
	require.NotNil(t, org)

	// Make sure changes are synced with other goroutines
	err = sqlStore.Sync()
	require.NoError(t, err)

	return sqlStore
}

// CreateGrafDir creates the Grafana directory.
// The log by default is muted in the regression test, to activate it, pass option EnableLog = true
func CreateGrafDir(t *testing.T, opts ...GrafanaOpts) (string, string) {
	t.Helper()

	tmpDir := t.TempDir()

	// Search upwards in directory tree for project root
	var rootDir string
	found := false
	for i := 0; i < 20; i++ {
		rootDir = filepath.Join(rootDir, "..")

		dir, err := filepath.Abs(rootDir)
		require.NoError(t, err)

		exists, err := fs.Exists(filepath.Join(dir, "public", "views"))
		require.NoError(t, err)

		if exists {
			rootDir = dir
			found = true
			break
		}
	}

	require.True(t, found, "Couldn't detect project root directory")

	cfgDir := filepath.Join(tmpDir, "conf")
	err := os.MkdirAll(cfgDir, 0750)
	require.NoError(t, err)
	dataDir := filepath.Join(tmpDir, "data")
	// nolint:gosec
	err = os.MkdirAll(dataDir, 0750)
	require.NoError(t, err)
	logsDir := filepath.Join(tmpDir, "logs")
	pluginsDir := filepath.Join(tmpDir, "plugins")
	publicDir := filepath.Join(tmpDir, "public")
	err = os.MkdirAll(publicDir, 0750)
	require.NoError(t, err)
	viewsDir := filepath.Join(publicDir, "views")
	err = fs.CopyRecursive(filepath.Join(rootDir, "public", "views"), viewsDir)
	require.NoError(t, err)
	// Copy index template to index.html, since Grafana will try to use the latter
	err = fs.CopyFile(filepath.Join(rootDir, "public", "views", "index-template.html"),
		filepath.Join(viewsDir, "index.html"))
	require.NoError(t, err)
	// Copy error template to error.html, since Grafana will try to use the latter
	err = fs.CopyFile(filepath.Join(rootDir, "public", "views", "error-template.html"),
		filepath.Join(viewsDir, "error.html"))
	require.NoError(t, err)
	emailsDir := filepath.Join(publicDir, "emails")
	err = fs.CopyRecursive(filepath.Join(rootDir, "public", "emails"), emailsDir)
	require.NoError(t, err)
	provDir := filepath.Join(cfgDir, "provisioning")
	provDSDir := filepath.Join(provDir, "datasources")
	err = os.MkdirAll(provDSDir, 0750)
	require.NoError(t, err)
	provNotifiersDir := filepath.Join(provDir, "notifiers")
	err = os.MkdirAll(provNotifiersDir, 0750)
	require.NoError(t, err)
	provPluginsDir := filepath.Join(provDir, "plugins")
	err = os.MkdirAll(provPluginsDir, 0750)
	require.NoError(t, err)
	provDashboardsDir := filepath.Join(provDir, "dashboards")
	err = os.MkdirAll(provDashboardsDir, 0750)
	require.NoError(t, err)
	corePluginsDir := filepath.Join(publicDir, "app/plugins")
	err = fs.CopyRecursive(filepath.Join(rootDir, "public", "app/plugins"), corePluginsDir)
	require.NoError(t, err)

	cfg := ini.Empty()
	dfltSect := cfg.Section("")
	_, err = dfltSect.NewKey("app_mode", "development")
	require.NoError(t, err)

	pathsSect, err := cfg.NewSection("paths")
	require.NoError(t, err)
	_, err = pathsSect.NewKey("data", dataDir)
	require.NoError(t, err)
	_, err = pathsSect.NewKey("logs", logsDir)
	require.NoError(t, err)
	_, err = pathsSect.NewKey("plugins", pluginsDir)
	require.NoError(t, err)

	logSect, err := cfg.NewSection("log")
	require.NoError(t, err)

	_, err = logSect.NewKey("level", "debug")
	require.NoError(t, err)

	serverSect, err := cfg.NewSection("server")
	require.NoError(t, err)
	_, err = serverSect.NewKey("port", "0")
	require.NoError(t, err)

	anonSect, err := cfg.NewSection("auth.anonymous")
	require.NoError(t, err)
	_, err = anonSect.NewKey("enabled", "true")
	require.NoError(t, err)

	alertingSect, err := cfg.NewSection("alerting")
	require.NoError(t, err)
	_, err = alertingSect.NewKey("notification_timeout_seconds", "1")
	require.NoError(t, err)
	_, err = alertingSect.NewKey("max_attempts", "3")
	require.NoError(t, err)

	rbacSect, err := cfg.NewSection("rbac")
	require.NoError(t, err)
	_, err = rbacSect.NewKey("permission_cache", "false")
	require.NoError(t, err)

	getOrCreateSection := func(name string) (*ini.Section, error) {
		section, err := cfg.GetSection(name)
		if err != nil {
			return cfg.NewSection(name)
		}
		return section, err
	}

	for _, o := range opts {
		if o.EnableCSP {
			securitySect, err := cfg.NewSection("security")
			require.NoError(t, err)
			_, err = securitySect.NewKey("content_security_policy", "true")
			require.NoError(t, err)
		}
		if len(o.EnableFeatureToggles) > 0 {
			featureSection, err := cfg.NewSection("feature_toggles")
			require.NoError(t, err)
			_, err = featureSection.NewKey("enable", strings.Join(o.EnableFeatureToggles, " "))
			require.NoError(t, err)
		}
		if o.NGAlertAdminConfigPollInterval != 0 {
			ngalertingSection, err := cfg.NewSection("unified_alerting")
			require.NoError(t, err)
			_, err = ngalertingSection.NewKey("admin_config_poll_interval", o.NGAlertAdminConfigPollInterval.String())
			require.NoError(t, err)
		}
		if o.NGAlertAlertmanagerConfigPollInterval != 0 {
			ngalertingSection, err := getOrCreateSection("unified_alerting")
			require.NoError(t, err)
			_, err = ngalertingSection.NewKey("alertmanager_config_poll_interval", o.NGAlertAlertmanagerConfigPollInterval.String())
			require.NoError(t, err)
		}
		if o.AppModeProduction {
			_, err = dfltSect.NewKey("app_mode", "production")
			require.NoError(t, err)
		}
		if o.AnonymousUserRole != "" {
			_, err = anonSect.NewKey("org_role", string(o.AnonymousUserRole))
			require.NoError(t, err)
		}
		if o.EnableQuota {
			quotaSection, err := cfg.NewSection("quota")
			require.NoError(t, err)
			_, err = quotaSection.NewKey("enabled", "true")
			require.NoError(t, err)
			dashboardQuota := int64(100)
			if o.DashboardOrgQuota != nil {
				dashboardQuota = *o.DashboardOrgQuota
			}
			_, err = quotaSection.NewKey("org_dashboard", strconv.FormatInt(dashboardQuota, 10))
			require.NoError(t, err)
		}
		if o.DisableAnonymous {
			anonSect, err := cfg.GetSection("auth.anonymous")
			require.NoError(t, err)
			_, err = anonSect.NewKey("enabled", "false")
			require.NoError(t, err)
		}
		if o.PluginAdminEnabled {
			anonSect, err := cfg.NewSection("plugins")
			require.NoError(t, err)
			_, err = anonSect.NewKey("plugin_admin_enabled", "true")
			require.NoError(t, err)
		}
		if o.PluginAdminExternalManageEnabled {
			anonSect, err := cfg.NewSection("plugins")
			require.NoError(t, err)
			_, err = anonSect.NewKey("plugin_admin_external_manage_enabled", "true")
			require.NoError(t, err)
		}
		if o.ViewersCanEdit {
			usersSection, err := cfg.NewSection("users")
			require.NoError(t, err)
			_, err = usersSection.NewKey("viewers_can_edit", "true")
			require.NoError(t, err)
		}
		if o.DisableLegacyAlerting {
			alertingSection, err := cfg.GetSection("alerting")
			require.NoError(t, err)
			_, err = alertingSection.NewKey("enabled", "false")
			require.NoError(t, err)
		}
		if o.EnableUnifiedAlerting {
			unifiedAlertingSection, err := getOrCreateSection("unified_alerting")
			require.NoError(t, err)
			_, err = unifiedAlertingSection.NewKey("enabled", "true")
			require.NoError(t, err)
		}
		if len(o.UnifiedAlertingDisabledOrgs) > 0 {
			unifiedAlertingSection, err := getOrCreateSection("unified_alerting")
			require.NoError(t, err)
			disableOrgStr := strings.Join(strings.Split(strings.Trim(fmt.Sprint(o.UnifiedAlertingDisabledOrgs), "[]"), " "), ",")
			_, err = unifiedAlertingSection.NewKey("disabled_orgs", disableOrgStr)
			require.NoError(t, err)
		}
		if !o.EnableLog {
			logSection, err := getOrCreateSection("log")
			require.NoError(t, err)
			_, err = logSection.NewKey("enabled", "false")
			require.NoError(t, err)
		}
	}

	cfgPath := filepath.Join(cfgDir, "test.ini")
	err = cfg.SaveTo(cfgPath)
	require.NoError(t, err)

	err = fs.CopyFile(filepath.Join(rootDir, "conf", "defaults.ini"), filepath.Join(cfgDir, "defaults.ini"))
	require.NoError(t, err)

	return tmpDir, cfgPath
}

type GrafanaOpts struct {
	EnableCSP                             bool
	EnableFeatureToggles                  []string
	NGAlertAdminConfigPollInterval        time.Duration
	NGAlertAlertmanagerConfigPollInterval time.Duration
	AnonymousUserRole                     org.RoleType
	EnableQuota                           bool
	DashboardOrgQuota                     *int64
	DisableAnonymous                      bool
	CatalogAppEnabled                     bool
	ViewersCanEdit                        bool
	PluginAdminEnabled                    bool
	PluginAdminExternalManageEnabled      bool
	AppModeProduction                     bool
	DisableLegacyAlerting                 bool
	EnableUnifiedAlerting                 bool
	UnifiedAlertingDisabledOrgs           []int64
	EnableLog                             bool
}

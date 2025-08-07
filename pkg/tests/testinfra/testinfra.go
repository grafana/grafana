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

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/dskit/kv"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

// StartGrafana starts a Grafana server.
// The server address is returned.
func StartGrafana(t *testing.T, grafDir, cfgPath string) (string, db.DB) {
	addr, env := StartGrafanaEnv(t, grafDir, cfgPath)
	return addr, env.SQLStore
}

func StartGrafanaEnv(t *testing.T, grafDir, cfgPath string) (string, *server.TestEnv) {
	t.Helper()
	ctx := context.Background()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{Config: cfgPath, HomePath: grafDir})
	require.NoError(t, err)
	serverOpts := server.Options{Listener: listener, HomePath: grafDir}
	apiServerOpts := api.ServerOptions{Listener: listener}

	// Replace the placeholder in the `signing_keys_url` with the actual address
	grpcServerAuthSection := cfg.SectionWithEnvOverrides("grpc_server_authentication")
	signingKeysUrl := grpcServerAuthSection.Key("signing_keys_url")
	signingKeysUrl.SetValue(strings.Replace(signingKeysUrl.String(), "<placeholder>", listener.Addr().String(), 1))

	// Potentially allocate a real gRPC port for unified storage
	runstore := false
	unistore, _ := cfg.Raw.GetSection("grafana-apiserver")
	if unistore != nil &&
		unistore.Key("storage_type").MustString("") == string(options.StorageTypeUnifiedGrpc) &&
		unistore.Key("address").String() == "" {
		// Allocate a new address
		listener2, err := net.Listen("tcp", "127.0.0.1:0")
		require.NoError(t, err)

		cfg.GRPCServer.Network = "tcp"
		cfg.GRPCServer.Address = listener2.Addr().String()
		cfg.GRPCServer.TLSConfig = nil
		_, err = unistore.NewKey("address", cfg.GRPCServer.Address)
		require.NoError(t, err)

		// release the one we just discovered -- it will be used by the services on startup
		err = listener2.Close()
		require.NoError(t, err)
		runstore = true
	}

	err = featuremgmt.InitOpenFeatureWithCfg(cfg)
	require.NoError(t, err)
	env, err := server.InitializeForTest(t, t, cfg, serverOpts, apiServerOpts)
	require.NoError(t, err)

	require.NotNil(t, env.Cfg)
	dbSec, err := env.Cfg.Raw.GetSection("database")
	require.NoError(t, err)
	assert.Greater(t, dbSec.Key("query_retries").MustInt(), 0)

	env.Server.HTTPServer.AddMiddleware(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if env.RequestMiddleware != nil {
				h := env.RequestMiddleware(next)
				h.ServeHTTP(w, r)
				return
			}

			next.ServeHTTP(w, r)
		})
	})

	// UnifiedStorageOverGRPC
	var storage sql.UnifiedStorageGrpcService
	if runstore {
		storage, err = sql.ProvideUnifiedStorageGrpcService(env.Cfg, env.FeatureToggles, env.SQLStore,
			env.Cfg.Logger, prometheus.NewPedanticRegistry(), nil, nil, nil, nil, kv.Config{})
		require.NoError(t, err)
		ctx := context.Background()
		err = storage.StartAsync(ctx)
		require.NoError(t, err)
		err = storage.AwaitRunning(ctx)
		require.NoError(t, err)

		require.NoError(t, err)
		t.Logf("Unified storage running on %s", storage.GetAddress())
	}

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
		if storage != nil {
			storage.StopAsync()
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

// CreateGrafDir creates the Grafana directory.
// The log by default is muted in the regression test, to activate it, pass option EnableLog = true
//
//nolint:gocyclo
func CreateGrafDir(t *testing.T, opts GrafanaOpts) (string, string) {
	t.Helper()

	tmpDir := t.TempDir()

	// Search upwards in directory tree for project root
	var rootDir string
	found := false
	for i := 0; i < 20; i++ {
		rootDir = filepath.Join(rootDir, "..")

		dir, err := filepath.Abs(rootDir)
		require.NoError(t, err)

		// When running within an enterprise test, we need to move to the grafana directory
		if strings.HasSuffix(dir, "grafana-enterprise") {
			rootDir = filepath.Join(rootDir, "..", "grafana")
			dir, err = filepath.Abs(rootDir)
			require.NoError(t, err)
		}

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

	// add a stub manifest to the build directory
	buildDir := filepath.Join(publicDir, "build")
	err = os.MkdirAll(buildDir, 0750)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte(`{
		"entrypoints": {
		  "app": {
			"assets": {
			  "js": ["public/build/runtime.XYZ.js"]
			}
		  },
		  "swagger": {
			"assets": {
			  "js": ["public/build/runtime.XYZ.js"]
			}
		  },
		  "dark": {
			"assets": {
			  "css": ["public/build/dark.css"]
			}
		  },
		  "light": {
			"assets": {
			  "css": ["public/build/light.css"]
			}
		  }
		},
		"runtime.50398398ecdeaf58968c.js": {
		  "src": "public/build/runtime.XYZ.js",
		  "integrity": "sha256-k1g7TksMHFQhhQGE"
		}
	  }
	  `), 0750)
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
	_, err = serverSect.NewKey("static_root_path", publicDir)
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

	if opts.EnableRecordingRules {
		recordingRulesSect, err := cfg.NewSection("recording_rules")
		require.NoError(t, err)
		_, err = recordingRulesSect.NewKey("enabled", "true")
		require.NoError(t, err)
	}

	if opts.LicensePath != "" {
		section, err := cfg.NewSection("enterprise")
		require.NoError(t, err)
		_, err = section.NewKey("license_path", opts.LicensePath)
		require.NoError(t, err)
	}

	rbacSect, err := cfg.NewSection("rbac")
	require.NoError(t, err)
	_, err = rbacSect.NewKey("permission_cache", "false")
	require.NoError(t, err)

	analyticsSect, err := cfg.NewSection("analytics")
	require.NoError(t, err)
	_, err = analyticsSect.NewKey("intercom_secret", "intercom_secret_at_config")
	require.NoError(t, err)

	grpcServerAuth, err := cfg.NewSection("grpc_server_authentication")
	require.NoError(t, err)
	_, err = grpcServerAuth.NewKey("signing_keys_url", "http://<placeholder>/api/signing-keys/keys")
	require.NoError(t, err)
	_, err = grpcServerAuth.NewKey("allowed_audiences", "org:1")
	require.NoError(t, err)

	getOrCreateSection := func(name string) (*ini.Section, error) {
		section, err := cfg.GetSection(name)
		if err != nil {
			return cfg.NewSection(name)
		}
		return section, err
	}

	queryRetries := 3
	if opts.EnableCSP {
		securitySect, err := cfg.NewSection("security")
		require.NoError(t, err)
		_, err = securitySect.NewKey("content_security_policy", "true")
		require.NoError(t, err)
	}
	if len(opts.EnableFeatureToggles) > 0 {
		featureSection, err := cfg.NewSection("feature_toggles")
		require.NoError(t, err)
		_, err = featureSection.NewKey("enable", strings.Join(opts.EnableFeatureToggles, " "))
		require.NoError(t, err)
	}
	if len(opts.DisableFeatureToggles) > 0 {
		featureSection, err := cfg.NewSection("feature_toggles")
		require.NoError(t, err)
		for _, toggle := range opts.DisableFeatureToggles {
			_, err = featureSection.NewKey(toggle, "false")
			require.NoError(t, err)
		}
	}
	if opts.NGAlertAdminConfigPollInterval != 0 {
		ngalertingSection, err := cfg.NewSection("unified_alerting")
		require.NoError(t, err)
		_, err = ngalertingSection.NewKey("admin_config_poll_interval", opts.NGAlertAdminConfigPollInterval.String())
		require.NoError(t, err)
	}
	if opts.NGAlertAlertmanagerConfigPollInterval != 0 {
		ngalertingSection, err := getOrCreateSection("unified_alerting")
		require.NoError(t, err)
		_, err = ngalertingSection.NewKey("alertmanager_config_poll_interval", opts.NGAlertAlertmanagerConfigPollInterval.String())
		require.NoError(t, err)
	}
	if opts.AppModeProduction {
		_, err = dfltSect.NewKey("app_mode", "production")
		require.NoError(t, err)
	}
	if opts.AnonymousUserRole != "" {
		_, err = anonSect.NewKey("org_role", string(opts.AnonymousUserRole))
		require.NoError(t, err)
	}
	if opts.EnableQuota {
		quotaSection, err := cfg.NewSection("quota")
		require.NoError(t, err)
		_, err = quotaSection.NewKey("enabled", "true")
		require.NoError(t, err)
		dashboardQuota := int64(100)
		if opts.DashboardOrgQuota != nil {
			dashboardQuota = *opts.DashboardOrgQuota
		}
		_, err = quotaSection.NewKey("org_dashboard", strconv.FormatInt(dashboardQuota, 10))
		require.NoError(t, err)
	}
	if opts.DisableAnonymous {
		anonSect, err := cfg.GetSection("auth.anonymous")
		require.NoError(t, err)
		_, err = anonSect.NewKey("enabled", "false")
		require.NoError(t, err)
	}
	if opts.PluginAdminEnabled {
		anonSect, err := cfg.NewSection("plugins")
		require.NoError(t, err)
		_, err = anonSect.NewKey("plugin_admin_enabled", "true")
		require.NoError(t, err)
	}
	if opts.PluginAdminExternalManageEnabled {
		anonSect, err := cfg.NewSection("plugins")
		require.NoError(t, err)
		_, err = anonSect.NewKey("plugin_admin_external_manage_enabled", "true")
		require.NoError(t, err)
	}
	if opts.ViewersCanEdit {
		usersSection, err := cfg.NewSection("users")
		require.NoError(t, err)
		_, err = usersSection.NewKey("viewers_can_edit", "true")
		require.NoError(t, err)
	}
	if opts.EnableUnifiedAlerting {
		unifiedAlertingSection, err := getOrCreateSection("unified_alerting")
		require.NoError(t, err)
		_, err = unifiedAlertingSection.NewKey("enabled", "true")
		require.NoError(t, err)
	}
	if len(opts.UnifiedAlertingDisabledOrgs) > 0 {
		unifiedAlertingSection, err := getOrCreateSection("unified_alerting")
		require.NoError(t, err)
		disableOrgStr := strings.Join(strings.Split(strings.Trim(fmt.Sprint(opts.UnifiedAlertingDisabledOrgs), "[]"), " "), ",")
		_, err = unifiedAlertingSection.NewKey("disabled_orgs", disableOrgStr)
		require.NoError(t, err)
	}
	if !opts.EnableLog {
		logSection, err := getOrCreateSection("log")
		require.NoError(t, err)
		_, err = logSection.NewKey("enabled", "false")
		require.NoError(t, err)
	} else {
		serverSection, err := getOrCreateSection("server")
		require.NoError(t, err)
		_, err = serverSection.NewKey("router_logging", "true")
		require.NoError(t, err)
	}

	if opts.APIServerStorageType != "" {
		section, err := getOrCreateSection("grafana-apiserver")
		require.NoError(t, err)
		_, err = section.NewKey("storage_type", string(opts.APIServerStorageType))
		require.NoError(t, err)

		// Hardcoded local etcd until this is needed to run in CI
		if opts.APIServerStorageType == "etcd" {
			_, err = section.NewKey("etcd_servers", "localhost:2379")
			require.NoError(t, err)
		}
	}

	if opts.GRPCServerAddress != "" {
		logSection, err := getOrCreateSection("grpc_server")
		require.NoError(t, err)
		_, err = logSection.NewKey("address", opts.GRPCServerAddress)
		require.NoError(t, err)
	}
	// retry queries 3 times by default
	if opts.QueryRetries != 0 {
		queryRetries = int(opts.QueryRetries)
	}

	if opts.NGAlertSchedulerBaseInterval > 0 {
		unifiedAlertingSection, err := getOrCreateSection("unified_alerting")
		require.NoError(t, err)
		_, err = unifiedAlertingSection.NewKey("scheduler_tick_interval", opts.NGAlertSchedulerBaseInterval.String())
		require.NoError(t, err)
		_, err = unifiedAlertingSection.NewKey("min_interval", opts.NGAlertSchedulerBaseInterval.String())
		require.NoError(t, err)
	}

	if opts.GrafanaComAPIURL != "" {
		grafanaComSection, err := getOrCreateSection("grafana_com")
		require.NoError(t, err)
		_, err = grafanaComSection.NewKey("api_url", opts.GrafanaComAPIURL)
		require.NoError(t, err)
	}

	if opts.RemoteAlertmanagerURL != "" {
		remoteAlertmanagerSection, err := getOrCreateSection("remote.alertmanager")
		require.NoError(t, err)
		_, err = remoteAlertmanagerSection.NewKey("enabled", "true")
		require.NoError(t, err)
		_, err = remoteAlertmanagerSection.NewKey("url", opts.RemoteAlertmanagerURL)
		require.NoError(t, err)
		_, err = remoteAlertmanagerSection.NewKey("tenant", "1")
		require.NoError(t, err)
	}
	if opts.GrafanaComSSOAPIToken != "" {
		grafanaComSection, err := getOrCreateSection("grafana_com")
		require.NoError(t, err)
		_, err = grafanaComSection.NewKey("sso_api_token", opts.GrafanaComSSOAPIToken)
		require.NoError(t, err)
	}

	if opts.UnifiedStorageConfig != nil {
		for k, v := range opts.UnifiedStorageConfig {
			section, err := getOrCreateSection(fmt.Sprintf("unified_storage.%s", k))
			require.NoError(t, err)
			_, err = section.NewKey("dualWriterMode", fmt.Sprintf("%d", v.DualWriterMode))
			require.NoError(t, err)
		}
	}
	if opts.UnifiedStorageMaxPageSizeBytes > 0 {
		section, err := getOrCreateSection("unified_storage")
		require.NoError(t, err)
		_, err = section.NewKey("max_page_size_bytes", fmt.Sprintf("%d", opts.UnifiedStorageMaxPageSizeBytes))
		require.NoError(t, err)
	}
	if opts.PermittedProvisioningPaths != "" {
		_, err = pathsSect.NewKey("permitted_provisioning_paths", opts.PermittedProvisioningPaths)
		require.NoError(t, err)
	}
	if opts.EnableSCIM {
		scimSection, err := getOrCreateSection("auth.scim")
		require.NoError(t, err)
		_, err = scimSection.NewKey("user_sync_enabled", "true")
		require.NoError(t, err)
		_, err = scimSection.NewKey("group_sync_enabled", "true")
		require.NoError(t, err)
	}

	if opts.APIServerRuntimeConfig != "" {
		section, err := getOrCreateSection("grafana-apiserver")
		require.NoError(t, err)
		_, err = section.NewKey("runtime_config", opts.APIServerRuntimeConfig)
		require.NoError(t, err)
	}
	dbSection, err := getOrCreateSection("database")
	require.NoError(t, err)
	_, err = dbSection.NewKey("query_retries", fmt.Sprintf("%d", queryRetries))
	require.NoError(t, err)
	_, err = dbSection.NewKey("max_open_conn", "2")
	require.NoError(t, err)
	_, err = dbSection.NewKey("max_idle_conn", "2")
	require.NoError(t, err)

	cfgPath := filepath.Join(cfgDir, "test.ini")
	err = cfg.SaveTo(cfgPath)
	require.NoError(t, err)

	err = fs.CopyFile(filepath.Join(rootDir, "conf", "defaults.ini"), filepath.Join(cfgDir, "defaults.ini"))
	require.NoError(t, err)

	return tmpDir, cfgPath
}

func SQLiteIntegrationTest(t *testing.T) {
	t.Helper()

	if testing.Short() || !db.IsTestDbSQLite() {
		t.Skip("skipping integration test")
	}
}

type GrafanaOpts struct {
	EnableCSP                             bool
	EnableFeatureToggles                  []string
	DisableFeatureToggles                 []string
	NGAlertAdminConfigPollInterval        time.Duration
	NGAlertAlertmanagerConfigPollInterval time.Duration
	NGAlertSchedulerBaseInterval          time.Duration
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
	GRPCServerAddress                     string
	QueryRetries                          int64
	GrafanaComAPIURL                      string
	UnifiedStorageConfig                  map[string]setting.UnifiedStorageConfig
	UnifiedStorageMaxPageSizeBytes        int
	PermittedProvisioningPaths            string
	GrafanaComSSOAPIToken                 string
	LicensePath                           string
	EnableRecordingRules                  bool
	EnableSCIM                            bool
	APIServerRuntimeConfig                string

	// When "unified-grpc" is selected it will also start the grpc server
	APIServerStorageType options.StorageType

	// Remote alertmanager configuration
	RemoteAlertmanagerURL string
}

func CreateUser(t *testing.T, store db.DB, cfg *setting.Cfg, cmd user.CreateUserCommand) *user.User {
	t.Helper()

	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1
	cmd.OrgID = 1

	quotaService := quotaimpl.ProvideService(store, cfg)
	orgService, err := orgimpl.ProvideService(store, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		store, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(), quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	o, err := orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: fmt.Sprintf("test org %d", time.Now().UnixNano())})
	require.NoError(t, err)

	cmd.OrgID = o.ID

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u
}

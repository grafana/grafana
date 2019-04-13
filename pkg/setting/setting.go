// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package setting

import (
	"bytes"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/go-macaron/session"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
	ini "gopkg.in/ini.v1"
)

type Scheme string

const (
	HTTP              Scheme = "http"
	HTTPS             Scheme = "https"
	SOCKET            Scheme = "socket"
	DEFAULT_HTTP_ADDR string = "0.0.0.0"
)

const (
	DEV                 = "development"
	PROD                = "production"
	TEST                = "test"
	APP_NAME            = "Grafana"
	APP_NAME_ENTERPRISE = "Grafana Enterprise"
)

var (
	ERR_TEMPLATE_NAME = "error"
)

var (
	// App settings.
	Env          = DEV
	AppUrl       string
	AppSubUrl    string
	InstanceName string

	// build
	BuildVersion    string
	BuildCommit     string
	BuildBranch     string
	BuildStamp      int64
	IsEnterprise    bool
	ApplicationName string

	// packaging
	Packaging = "unknown"

	// Paths
	HomePath       string
	PluginsPath    string
	CustomInitPath = "conf/custom.ini"

	// Log settings.
	LogConfigs []util.DynMap

	// Http server options
	Protocol           Scheme
	Domain             string
	HttpAddr, HttpPort string
	SshPort            int
	CertFile, KeyFile  string
	SocketPath         string
	RouterLogging      bool
	DataProxyLogging   bool
	DataProxyTimeout   int
	StaticRootPath     string
	EnableGzip         bool
	EnforceDomain      bool

	// Security settings.
	SecretKey                        string
	DisableGravatar                  bool
	EmailCodeValidMinutes            int
	DataProxyWhiteList               map[string]bool
	DisableBruteForceLoginProtection bool
	CookieSecure                     bool
	CookieSameSite                   http.SameSite

	// Snapshots
	ExternalSnapshotUrl   string
	ExternalSnapshotName  string
	ExternalEnabled       bool
	SnapShotRemoveExpired bool

	// Dashboard history
	DashboardVersionsToKeep int

	// User settings
	AllowUserSignUp         bool
	AllowUserOrgCreate      bool
	AutoAssignOrg           bool
	AutoAssignOrgId         int
	AutoAssignOrgRole       string
	VerifyEmailEnabled      bool
	LoginHint               string
	PasswordHint            string
	DefaultTheme            string
	DisableLoginForm        bool
	DisableSignoutMenu      bool
	SignoutRedirectUrl      string
	ExternalUserMngLinkUrl  string
	ExternalUserMngLinkName string
	ExternalUserMngInfo     string
	OAuthAutoLogin          bool
	ViewersCanEdit          bool

	// Http auth
	AdminUser            string
	AdminPassword        string
	LoginCookieName      string
	LoginMaxLifetimeDays int

	AnonymousEnabled bool
	AnonymousOrgName string
	AnonymousOrgRole string

	// Auth proxy settings
	AuthProxyEnabled        bool
	AuthProxyHeaderName     string
	AuthProxyHeaderProperty string
	AuthProxyAutoSignUp     bool
	AuthProxyLdapSyncTtl    int
	AuthProxyWhitelist      string
	AuthProxyHeaders        map[string]string

	// Basic Auth
	BasicAuthEnabled bool

	// Session settings.
	SessionOptions         session.Options
	SessionConnMaxLifetime int64

	// Global setting objects.
	Raw          *ini.File
	ConfRootPath string
	IsWindows    bool

	// for logging purposes
	configFiles                  []string
	appliedCommandLineProperties []string
	appliedEnvOverrides          []string

	ReportingEnabled   bool
	CheckForUpdates    bool
	GoogleAnalyticsId  string
	GoogleTagManagerId string

	// LDAP
	LdapEnabled     bool
	LdapConfigFile  string
	LdapAllowSignup = true

	// QUOTA
	Quota QuotaSettings

	// Alerting
	AlertingEnabled            bool
	ExecuteAlerts              bool
	AlertingRenderLimit        int
	AlertingErrorOrTimeout     string
	AlertingNoDataOrNullValues string

	AlertingEvaluationTimeout   time.Duration
	AlertingNotificationTimeout time.Duration
	AlertingMaxAttempts         int

	// Explore UI
	ExploreEnabled bool

	// logger
	logger log.Logger

	// Grafana.NET URL
	GrafanaComUrl string

	// S3 temp image store
	S3TempImageStoreBucketUrl string
	S3TempImageStoreAccessKey string
	S3TempImageStoreSecretKey string

	ImageUploadProvider string
)

// TODO move all global vars to this struct
type Cfg struct {
	Raw *ini.File

	// HTTP Server Settings
	AppUrl    string
	AppSubUrl string

	// Paths
	ProvisioningPath string
	DataPath         string
	LogsPath         string

	// SMTP email settings
	Smtp SmtpSettings

	// Rendering
	ImagesDir             string
	PhantomDir            string
	RendererUrl           string
	RendererCallbackUrl   string
	RendererLimit         int
	RendererLimitAlerting int

	// Security
	DisableBruteForceLoginProtection bool
	CookieSecure                     bool
	CookieSameSite                   http.SameSite

	TempDataLifetime                 time.Duration
	MetricsEndpointEnabled           bool
	MetricsEndpointBasicAuthUsername string
	MetricsEndpointBasicAuthPassword string
	PluginsEnableAlpha               bool
	PluginsAppsSkipVerifyTLS         bool
	DisableSanitizeHtml              bool
	EnterpriseLicensePath            string

	// Auth
	LoginCookieName              string
	LoginMaxInactiveLifetimeDays int
	LoginMaxLifetimeDays         int
	TokenRotationIntervalMinutes int

	// Dataproxy
	SendUserHeader bool

	// DistributedCache
	RemoteCacheOptions *RemoteCacheOptions

	EditorsCanAdmin bool
}

type CommandLineArgs struct {
	Config   string
	HomePath string
	Args     []string
}

func init() {
	IsWindows = runtime.GOOS == "windows"
	logger = log.New("settings")
}

func parseAppUrlAndSubUrl(section *ini.Section) (string, string) {
	appUrl := valueAsString(section, "root_url", "http://localhost:3000/")
	if appUrl[len(appUrl)-1] != '/' {
		appUrl += "/"
	}

	// Check if has app suburl.
	url, err := url.Parse(appUrl)
	if err != nil {
		log.Fatal(4, "Invalid root_url(%s): %s", appUrl, err)
	}
	appSubUrl := strings.TrimSuffix(url.Path, "/")

	return appUrl, appSubUrl
}

func ToAbsUrl(relativeUrl string) string {
	return AppUrl + relativeUrl
}

func shouldRedactKey(s string) bool {
	uppercased := strings.ToUpper(s)
	return strings.Contains(uppercased, "PASSWORD") || strings.Contains(uppercased, "SECRET") || strings.Contains(uppercased, "PROVIDER_CONFIG")
}

func shouldRedactURLKey(s string) bool {
	uppercased := strings.ToUpper(s)
	return strings.Contains(uppercased, "DATABASE_URL")
}

func applyEnvVariableOverrides(file *ini.File) error {
	appliedEnvOverrides = make([]string, 0)
	for _, section := range file.Sections() {
		for _, key := range section.Keys() {
			sectionName := strings.ToUpper(strings.Replace(section.Name(), ".", "_", -1))
			keyName := strings.ToUpper(strings.Replace(key.Name(), ".", "_", -1))
			envKey := fmt.Sprintf("GF_%s_%s", sectionName, keyName)
			envValue := os.Getenv(envKey)

			if len(envValue) > 0 {
				key.SetValue(envValue)
				if shouldRedactKey(envKey) {
					envValue = "*********"
				}
				if shouldRedactURLKey(envKey) {
					u, err := url.Parse(envValue)
					if err != nil {
						return fmt.Errorf("could not parse environment variable. key: %s, value: %s. error: %v", envKey, envValue, err)
					}
					ui := u.User
					if ui != nil {
						_, exists := ui.Password()
						if exists {
							u.User = url.UserPassword(ui.Username(), "-redacted-")
							envValue = u.String()
						}
					}
				}
				appliedEnvOverrides = append(appliedEnvOverrides, fmt.Sprintf("%s=%s", envKey, envValue))
			}
		}
	}

	return nil
}

func applyCommandLineDefaultProperties(props map[string]string, file *ini.File) {
	appliedCommandLineProperties = make([]string, 0)
	for _, section := range file.Sections() {
		for _, key := range section.Keys() {
			keyString := fmt.Sprintf("default.%s.%s", section.Name(), key.Name())
			value, exists := props[keyString]
			if exists {
				key.SetValue(value)
				if shouldRedactKey(keyString) {
					value = "*********"
				}
				appliedCommandLineProperties = append(appliedCommandLineProperties, fmt.Sprintf("%s=%s", keyString, value))
			}
		}
	}
}

func applyCommandLineProperties(props map[string]string, file *ini.File) {
	for _, section := range file.Sections() {
		sectionName := section.Name() + "."
		if section.Name() == ini.DEFAULT_SECTION {
			sectionName = ""
		}
		for _, key := range section.Keys() {
			keyString := sectionName + key.Name()
			value, exists := props[keyString]
			if exists {
				appliedCommandLineProperties = append(appliedCommandLineProperties, fmt.Sprintf("%s=%s", keyString, value))
				key.SetValue(value)
			}
		}
	}
}

func getCommandLineProperties(args []string) map[string]string {
	props := make(map[string]string)

	for _, arg := range args {
		if !strings.HasPrefix(arg, "cfg:") {
			continue
		}

		trimmed := strings.TrimPrefix(arg, "cfg:")
		parts := strings.Split(trimmed, "=")
		if len(parts) != 2 {
			log.Fatal(3, "Invalid command line argument. argument: %v", arg)
			return nil
		}

		props[parts[0]] = parts[1]
	}
	return props
}

func makeAbsolute(path string, root string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(root, path)
}

func evalEnvVarExpression(value string) string {
	regex := regexp.MustCompile(`\${(\w+)}`)
	return regex.ReplaceAllStringFunc(value, func(envVar string) string {
		envVar = strings.TrimPrefix(envVar, "${")
		envVar = strings.TrimSuffix(envVar, "}")
		envValue := os.Getenv(envVar)

		// if env variable is hostname and it is empty use os.Hostname as default
		if envVar == "HOSTNAME" && envValue == "" {
			envValue, _ = os.Hostname()
		}

		return envValue
	})
}

func evalConfigValues(file *ini.File) {
	for _, section := range file.Sections() {
		for _, key := range section.Keys() {
			key.SetValue(evalEnvVarExpression(key.Value()))
		}
	}
}

func loadSpecifedConfigFile(configFile string, masterFile *ini.File) error {
	if configFile == "" {
		configFile = filepath.Join(HomePath, CustomInitPath)
		// return without error if custom file does not exist
		if !pathExists(configFile) {
			return nil
		}
	}

	userConfig, err := ini.Load(configFile)
	if err != nil {
		return fmt.Errorf("Failed to parse %v, %v", configFile, err)
	}

	userConfig.BlockMode = false

	for _, section := range userConfig.Sections() {
		for _, key := range section.Keys() {
			if key.Value() == "" {
				continue
			}

			defaultSec, err := masterFile.GetSection(section.Name())
			if err != nil {
				defaultSec, _ = masterFile.NewSection(section.Name())
			}
			defaultKey, err := defaultSec.GetKey(key.Name())
			if err != nil {
				defaultKey, _ = defaultSec.NewKey(key.Name(), key.Value())
			}
			defaultKey.SetValue(key.Value())
		}
	}

	configFiles = append(configFiles, configFile)
	return nil
}

func (cfg *Cfg) loadConfiguration(args *CommandLineArgs) (*ini.File, error) {
	var err error

	// load config defaults
	defaultConfigFile := path.Join(HomePath, "conf/defaults.ini")
	configFiles = append(configFiles, defaultConfigFile)

	// check if config file exists
	if _, err := os.Stat(defaultConfigFile); os.IsNotExist(err) {
		fmt.Println("Grafana-server Init Failed: Could not find config defaults, make sure homepath command line parameter is set or working directory is homepath")
		os.Exit(1)
	}

	// load defaults
	parsedFile, err := ini.Load(defaultConfigFile)
	if err != nil {
		fmt.Println(fmt.Sprintf("Failed to parse defaults.ini, %v", err))
		os.Exit(1)
		return nil, err
	}

	parsedFile.BlockMode = false

	// command line props
	commandLineProps := getCommandLineProperties(args.Args)
	// load default overrides
	applyCommandLineDefaultProperties(commandLineProps, parsedFile)

	// load specified config file
	err = loadSpecifedConfigFile(args.Config, parsedFile)
	if err != nil {
		cfg.initLogging(parsedFile)
		log.Fatal(3, err.Error())
	}

	// apply environment overrides
	err = applyEnvVariableOverrides(parsedFile)
	if err != nil {
		return nil, err
	}

	// apply command line overrides
	applyCommandLineProperties(commandLineProps, parsedFile)

	// evaluate config values containing environment variables
	evalConfigValues(parsedFile)

	// update data path and logging config
	cfg.DataPath = makeAbsolute(valueAsString(parsedFile.Section("paths"), "data", ""), HomePath)
	cfg.initLogging(parsedFile)

	return parsedFile, err
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	if err == nil {
		return true
	}
	if os.IsNotExist(err) {
		return false
	}
	return false
}

func setHomePath(args *CommandLineArgs) {
	if args.HomePath != "" {
		HomePath = args.HomePath
		return
	}

	HomePath, _ = filepath.Abs(".")
	// check if homepath is correct
	if pathExists(filepath.Join(HomePath, "conf/defaults.ini")) {
		return
	}

	// try down one path
	if pathExists(filepath.Join(HomePath, "../conf/defaults.ini")) {
		HomePath = filepath.Join(HomePath, "../")
	}
}

var skipStaticRootValidation = false

func validateStaticRootPath() error {
	if skipStaticRootValidation {
		return nil
	}

	if _, err := os.Stat(path.Join(StaticRootPath, "build")); err != nil {
		logger.Error("Failed to detect generated javascript files in public/build")
	}

	return nil
}

func NewCfg() *Cfg {
	return &Cfg{
		Raw: ini.Empty(),
	}
}

func (cfg *Cfg) Load(args *CommandLineArgs) error {
	setHomePath(args)

	iniFile, err := cfg.loadConfiguration(args)
	if err != nil {
		return err
	}

	cfg.Raw = iniFile

	// Temporary keep global, to make refactor in steps
	Raw = cfg.Raw

	ApplicationName = APP_NAME
	if IsEnterprise {
		ApplicationName = APP_NAME_ENTERPRISE
	}

	Env = valueAsString(iniFile.Section(""), "app_mode", "development")
	InstanceName = valueAsString(iniFile.Section(""), "instance_name", "unknown_instance_name")
	PluginsPath = makeAbsolute(valueAsString(iniFile.Section("paths"), "plugins", ""), HomePath)
	cfg.ProvisioningPath = makeAbsolute(valueAsString(iniFile.Section("paths"), "provisioning", ""), HomePath)
	server := iniFile.Section("server")
	AppUrl, AppSubUrl = parseAppUrlAndSubUrl(server)
	cfg.AppUrl = AppUrl
	cfg.AppSubUrl = AppSubUrl

	Protocol = HTTP
	if valueAsString(server, "protocol", "http") == "https" {
		Protocol = HTTPS
		CertFile = server.Key("cert_file").String()
		KeyFile = server.Key("cert_key").String()
	}
	if valueAsString(server, "protocol", "http") == "socket" {
		Protocol = SOCKET
		SocketPath = server.Key("socket").String()
	}

	Domain = valueAsString(server, "domain", "localhost")
	HttpAddr = valueAsString(server, "http_addr", DEFAULT_HTTP_ADDR)
	HttpPort = valueAsString(server, "http_port", "3000")
	RouterLogging = server.Key("router_logging").MustBool(false)

	EnableGzip = server.Key("enable_gzip").MustBool(false)
	EnforceDomain = server.Key("enforce_domain").MustBool(false)
	StaticRootPath = makeAbsolute(valueAsString(server, "static_root_path", ""), HomePath)

	if err := validateStaticRootPath(); err != nil {
		return err
	}

	// read data proxy settings
	dataproxy := iniFile.Section("dataproxy")
	DataProxyLogging = dataproxy.Key("logging").MustBool(false)
	DataProxyTimeout = dataproxy.Key("timeout").MustInt(30)
	cfg.SendUserHeader = dataproxy.Key("send_user_header").MustBool(false)

	// read security settings
	security := iniFile.Section("security")
	SecretKey = valueAsString(security, "secret_key", "")
	DisableGravatar = security.Key("disable_gravatar").MustBool(true)
	cfg.DisableBruteForceLoginProtection = security.Key("disable_brute_force_login_protection").MustBool(false)
	DisableBruteForceLoginProtection = cfg.DisableBruteForceLoginProtection

	CookieSecure = security.Key("cookie_secure").MustBool(false)
	cfg.CookieSecure = CookieSecure

	samesiteString := valueAsString(security, "cookie_samesite", "lax")
	validSameSiteValues := map[string]http.SameSite{
		"lax":    http.SameSiteLaxMode,
		"strict": http.SameSiteStrictMode,
		"none":   http.SameSiteDefaultMode,
	}

	if samesite, ok := validSameSiteValues[samesiteString]; ok {
		CookieSameSite = samesite
		cfg.CookieSameSite = CookieSameSite
	} else {
		CookieSameSite = http.SameSiteLaxMode
		cfg.CookieSameSite = CookieSameSite
	}

	// read snapshots settings
	snapshots := iniFile.Section("snapshots")
	ExternalSnapshotUrl = valueAsString(snapshots, "external_snapshot_url", "")
	ExternalSnapshotName = valueAsString(snapshots, "external_snapshot_name", "")
	ExternalEnabled = snapshots.Key("external_enabled").MustBool(true)
	SnapShotRemoveExpired = snapshots.Key("snapshot_remove_expired").MustBool(true)

	// read dashboard settings
	dashboards := iniFile.Section("dashboards")
	DashboardVersionsToKeep = dashboards.Key("versions_to_keep").MustInt(20)

	//  read data source proxy white list
	DataProxyWhiteList = make(map[string]bool)
	for _, hostAndIp := range util.SplitString(valueAsString(security, "data_source_proxy_whitelist", "")) {
		DataProxyWhiteList[hostAndIp] = true
	}

	// admin
	AdminUser = valueAsString(security, "admin_user", "")
	AdminPassword = valueAsString(security, "admin_password", "")

	// users
	users := iniFile.Section("users")
	AllowUserSignUp = users.Key("allow_sign_up").MustBool(true)
	AllowUserOrgCreate = users.Key("allow_org_create").MustBool(true)
	AutoAssignOrg = users.Key("auto_assign_org").MustBool(true)
	AutoAssignOrgId = users.Key("auto_assign_org_id").MustInt(1)
	AutoAssignOrgRole = users.Key("auto_assign_org_role").In("Editor", []string{"Editor", "Admin", "Viewer"})
	VerifyEmailEnabled = users.Key("verify_email_enabled").MustBool(false)
	LoginHint = valueAsString(users, "login_hint", "")
	PasswordHint = valueAsString(users, "password_hint", "")
	DefaultTheme = valueAsString(users, "default_theme", "")
	ExternalUserMngLinkUrl = valueAsString(users, "external_manage_link_url", "")
	ExternalUserMngLinkName = valueAsString(users, "external_manage_link_name", "")
	ExternalUserMngInfo = valueAsString(users, "external_manage_info", "")
	ViewersCanEdit = users.Key("viewers_can_edit").MustBool(false)
	cfg.EditorsCanAdmin = users.Key("editors_can_admin").MustBool(false)

	// auth
	auth := iniFile.Section("auth")

	LoginCookieName = valueAsString(auth, "login_cookie_name", "grafana_session")
	cfg.LoginCookieName = LoginCookieName
	cfg.LoginMaxInactiveLifetimeDays = auth.Key("login_maximum_inactive_lifetime_days").MustInt(7)

	LoginMaxLifetimeDays = auth.Key("login_maximum_lifetime_days").MustInt(30)
	cfg.LoginMaxLifetimeDays = LoginMaxLifetimeDays

	cfg.TokenRotationIntervalMinutes = auth.Key("token_rotation_interval_minutes").MustInt(10)
	if cfg.TokenRotationIntervalMinutes < 2 {
		cfg.TokenRotationIntervalMinutes = 2
	}

	DisableLoginForm = auth.Key("disable_login_form").MustBool(false)
	DisableSignoutMenu = auth.Key("disable_signout_menu").MustBool(false)
	OAuthAutoLogin = auth.Key("oauth_auto_login").MustBool(false)
	SignoutRedirectUrl = valueAsString(auth, "signout_redirect_url", "")

	// anonymous access
	AnonymousEnabled = iniFile.Section("auth.anonymous").Key("enabled").MustBool(false)
	AnonymousOrgName = valueAsString(iniFile.Section("auth.anonymous"), "org_name", "")
	AnonymousOrgRole = valueAsString(iniFile.Section("auth.anonymous"), "org_role", "")

	// auth proxy
	authProxy := iniFile.Section("auth.proxy")
	AuthProxyEnabled = authProxy.Key("enabled").MustBool(false)
	AuthProxyHeaderName = valueAsString(authProxy, "header_name", "")
	AuthProxyHeaderProperty = valueAsString(authProxy, "header_property", "")
	AuthProxyAutoSignUp = authProxy.Key("auto_sign_up").MustBool(true)
	AuthProxyLdapSyncTtl = authProxy.Key("ldap_sync_ttl").MustInt()
	AuthProxyWhitelist = valueAsString(authProxy, "whitelist", "")

	AuthProxyHeaders = make(map[string]string)
	for _, propertyAndHeader := range util.SplitString(valueAsString(authProxy, "headers", "")) {
		split := strings.SplitN(propertyAndHeader, ":", 2)
		if len(split) == 2 {
			AuthProxyHeaders[split[0]] = split[1]
		}
	}

	// basic auth
	authBasic := iniFile.Section("auth.basic")
	BasicAuthEnabled = authBasic.Key("enabled").MustBool(true)

	// Rendering
	renderSec := iniFile.Section("rendering")
	cfg.RendererUrl = valueAsString(renderSec, "server_url", "")
	cfg.RendererCallbackUrl = valueAsString(renderSec, "callback_url", "")
	if cfg.RendererCallbackUrl == "" {
		cfg.RendererCallbackUrl = AppUrl
	} else {
		if cfg.RendererCallbackUrl[len(cfg.RendererCallbackUrl)-1] != '/' {
			cfg.RendererCallbackUrl += "/"
		}
		_, err := url.Parse(cfg.RendererCallbackUrl)
		if err != nil {
			log.Fatal(4, "Invalid callback_url(%s): %s", cfg.RendererCallbackUrl, err)
		}
	}
	cfg.ImagesDir = filepath.Join(cfg.DataPath, "png")
	cfg.PhantomDir = filepath.Join(HomePath, "tools/phantomjs")
	cfg.TempDataLifetime = iniFile.Section("paths").Key("temp_data_lifetime").MustDuration(time.Second * 3600 * 24)
	cfg.MetricsEndpointEnabled = iniFile.Section("metrics").Key("enabled").MustBool(true)
	cfg.MetricsEndpointBasicAuthUsername = valueAsString(iniFile.Section("metrics"), "basic_auth_username", "")
	cfg.MetricsEndpointBasicAuthPassword = valueAsString(iniFile.Section("metrics"), "basic_auth_password", "")

	analytics := iniFile.Section("analytics")
	ReportingEnabled = analytics.Key("reporting_enabled").MustBool(true)
	CheckForUpdates = analytics.Key("check_for_updates").MustBool(true)
	GoogleAnalyticsId = valueAsString(analytics, "google_analytics_ua_id", "")
	GoogleTagManagerId = valueAsString(analytics, "google_tag_manager_id", "")

	ldapSec := iniFile.Section("auth.ldap")
	LdapEnabled = ldapSec.Key("enabled").MustBool(false)
	LdapConfigFile = valueAsString(ldapSec, "config_file", "")
	LdapAllowSignup = ldapSec.Key("allow_sign_up").MustBool(true)

	alerting := iniFile.Section("alerting")
	AlertingEnabled = alerting.Key("enabled").MustBool(true)
	ExecuteAlerts = alerting.Key("execute_alerts").MustBool(true)
	AlertingRenderLimit = alerting.Key("concurrent_render_limit").MustInt(5)
	AlertingErrorOrTimeout = valueAsString(alerting, "error_or_timeout", "alerting")
	AlertingNoDataOrNullValues = valueAsString(alerting, "nodata_or_nullvalues", "no_data")

	AlertingEvaluationTimeout = alerting.Key("evaluation_timeout_seconds").MustDuration(time.Second * 30)
	AlertingNotificationTimeout = alerting.Key("notification_timeout_seconds").MustDuration(time.Second * 30)
	AlertingMaxAttempts = alerting.Key("max_attempts").MustInt(3)

	explore := iniFile.Section("explore")
	ExploreEnabled = explore.Key("enabled").MustBool(true)

	panelsSection := iniFile.Section("panels")
	cfg.DisableSanitizeHtml = panelsSection.Key("disable_sanitize_html").MustBool(false)

	pluginsSection := iniFile.Section("plugins")
	cfg.PluginsEnableAlpha = pluginsSection.Key("enable_alpha").MustBool(false)
	cfg.PluginsAppsSkipVerifyTLS = iniFile.Section("plugins").Key("app_tls_skip_verify_insecure").MustBool(false)

	// check old location for this option
	if panelsSection.Key("enable_alpha").MustBool(false) {
		cfg.PluginsEnableAlpha = true
	}

	cfg.readSessionConfig()
	cfg.readSmtpSettings()
	cfg.readQuotaSettings()

	if VerifyEmailEnabled && !cfg.Smtp.Enabled {
		log.Warn("require_email_validation is enabled but smtp is disabled")
	}

	// check old key  name
	GrafanaComUrl = valueAsString(iniFile.Section("grafana_net"), "url", "")
	if GrafanaComUrl == "" {
		GrafanaComUrl = valueAsString(iniFile.Section("grafana_com"), "url", "https://grafana.com")
	}

	imageUploadingSection := iniFile.Section("external_image_storage")
	ImageUploadProvider = valueAsString(imageUploadingSection, "provider", "")

	enterprise := iniFile.Section("enterprise")
	cfg.EnterpriseLicensePath = valueAsString(enterprise, "license_path", filepath.Join(cfg.DataPath, "license.jwt"))

	cacheServer := iniFile.Section("remote_cache")
	cfg.RemoteCacheOptions = &RemoteCacheOptions{
		Name:    valueAsString(cacheServer, "type", "database"),
		ConnStr: valueAsString(cacheServer, "connstr", ""),
	}

	return nil
}

func valueAsString(section *ini.Section, keyName string, defaultValue string) string {
	defer func() {
		if err := recover(); err != nil {
			log.Fatal(4, "Invalid value for key '%s' in configuration file", keyName)
		}
	}()

	return section.Key(keyName).MustString(defaultValue)
}

type RemoteCacheOptions struct {
	Name    string
	ConnStr string
}

func (cfg *Cfg) readSessionConfig() {
	sec := cfg.Raw.Section("session")
	SessionOptions = session.Options{}
	SessionOptions.Provider = sec.Key("provider").In("memory", []string{"memory", "file", "redis", "mysql", "postgres", "memcache"})
	SessionOptions.ProviderConfig = strings.Trim(valueAsString(sec, "provider_config", ""), "\" ")
	SessionOptions.CookieName = valueAsString(sec, "cookie_name", "grafana_sess")
	SessionOptions.CookiePath = AppSubUrl
	SessionOptions.Secure = sec.Key("cookie_secure").MustBool()
	SessionOptions.Gclifetime = cfg.Raw.Section("session").Key("gc_interval_time").MustInt64(86400)
	SessionOptions.Maxlifetime = cfg.Raw.Section("session").Key("session_life_time").MustInt64(86400)
	SessionOptions.IDLength = 16

	if SessionOptions.Provider == "file" {
		SessionOptions.ProviderConfig = makeAbsolute(SessionOptions.ProviderConfig, cfg.DataPath)
		os.MkdirAll(path.Dir(SessionOptions.ProviderConfig), os.ModePerm)
	}

	if SessionOptions.CookiePath == "" {
		SessionOptions.CookiePath = "/"
	}

	SessionConnMaxLifetime = cfg.Raw.Section("session").Key("conn_max_lifetime").MustInt64(14400)
}

func (cfg *Cfg) initLogging(file *ini.File) {
	// split on comma
	logModes := strings.Split(valueAsString(file.Section("log"), "mode", "console"), ",")
	// also try space
	if len(logModes) == 1 {
		logModes = strings.Split(valueAsString(file.Section("log"), "mode", "console"), " ")
	}
	cfg.LogsPath = makeAbsolute(valueAsString(file.Section("paths"), "logs", ""), HomePath)
	log.ReadLoggingConfig(logModes, cfg.LogsPath, file)
}

func (cfg *Cfg) LogConfigSources() {
	var text bytes.Buffer

	for _, file := range configFiles {
		logger.Info("Config loaded from", "file", file)
	}

	if len(appliedCommandLineProperties) > 0 {
		for _, prop := range appliedCommandLineProperties {
			logger.Info("Config overridden from command line", "arg", prop)
		}
	}

	if len(appliedEnvOverrides) > 0 {
		text.WriteString("\tEnvironment variables used:\n")
		for _, prop := range appliedEnvOverrides {
			logger.Info("Config overridden from Environment variable", "var", prop)
		}
	}

	logger.Info("Path Home", "path", HomePath)
	logger.Info("Path Data", "path", cfg.DataPath)
	logger.Info("Path Logs", "path", cfg.LogsPath)
	logger.Info("Path Plugins", "path", PluginsPath)
	logger.Info("Path Provisioning", "path", cfg.ProvisioningPath)
	logger.Info("App mode " + Env)
}

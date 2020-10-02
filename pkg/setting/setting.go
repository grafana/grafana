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
	"runtime"
	"strings"
	"time"

	"github.com/go-macaron/session"
	ini "gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

type Scheme string

const (
	HTTPScheme   Scheme = "http"
	HTTPSScheme  Scheme = "https"
	HTTP2Scheme  Scheme = "h2"
	SocketScheme Scheme = "socket"
)

const (
	redactedPassword = "*********"
	DefaultHTTPAddr  = "0.0.0.0"
	Dev              = "development"
	Prod             = "production"
	Test             = "test"
)

var (
	ErrTemplateName = "error"
)

// This constant corresponds to the default value for ldap_sync_ttl in .ini files
// it is used for comparison and has to be kept in sync
const (
	AuthProxySyncTTL = 60
)

var (
	// App settings.
	Env              = Dev
	AppUrl           string
	AppSubUrl        string
	ServeFromSubPath bool
	InstanceName     string

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
	SecretKey                         string
	DisableGravatar                   bool
	EmailCodeValidMinutes             int
	DataProxyWhiteList                map[string]bool
	DisableBruteForceLoginProtection  bool
	CookieSecure                      bool
	CookieSameSiteDisabled            bool
	CookieSameSiteMode                http.SameSite
	AllowEmbedding                    bool
	XSSProtectionHeader               bool
	ContentTypeProtectionHeader       bool
	StrictTransportSecurity           bool
	StrictTransportSecurityMaxAge     int
	StrictTransportSecurityPreload    bool
	StrictTransportSecuritySubDomains bool

	// Snapshots
	ExternalSnapshotUrl   string
	ExternalSnapshotName  string
	ExternalEnabled       bool
	SnapShotRemoveExpired bool
	SnapshotPublicMode    bool

	// Dashboard history
	DashboardVersionsToKeep int
	MinRefreshInterval      string

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
	AdminUser        string
	AdminPassword    string
	LoginCookieName  string
	LoginMaxLifetime time.Duration

	AnonymousEnabled bool
	AnonymousOrgName string
	AnonymousOrgRole string

	// Auth proxy settings
	AuthProxyEnabled          bool
	AuthProxyHeaderName       string
	AuthProxyHeaderProperty   string
	AuthProxyAutoSignUp       bool
	AuthProxyEnableLoginToken bool
	AuthProxySyncTtl          int
	AuthProxyWhitelist        string
	AuthProxyHeaders          map[string]string

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
	LDAPEnabled           bool
	LDAPConfigFile        string
	LDAPSyncCron          string
	LDAPAllowSignup       bool
	LDAPActiveSyncEnabled bool

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
	AlertingMinInterval         int64

	// Explore UI
	ExploreEnabled bool

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
	Raw    *ini.File
	Logger log.Logger

	// HTTP Server Settings
	AppUrl           string
	AppSubUrl        string
	ServeFromSubPath bool
	StaticRootPath   string
	Protocol         Scheme

	// build
	BuildVersion string
	BuildCommit  string
	BuildBranch  string
	BuildStamp   int64
	IsEnterprise bool

	// packaging
	Packaging string

	// Paths
	ProvisioningPath   string
	DataPath           string
	LogsPath           string
	BundledPluginsPath string

	// SMTP email settings
	Smtp SmtpSettings

	// Rendering
	ImagesDir                      string
	RendererUrl                    string
	RendererCallbackUrl            string
	RendererConcurrentRequestLimit int

	// Security
	DisableInitAdminCreation         bool
	DisableBruteForceLoginProtection bool
	CookieSecure                     bool
	CookieSameSiteDisabled           bool
	CookieSameSiteMode               http.SameSite

	TempDataLifetime                 time.Duration
	MetricsEndpointEnabled           bool
	MetricsEndpointBasicAuthUsername string
	MetricsEndpointBasicAuthPassword string
	MetricsEndpointDisableTotalStats bool
	PluginsEnableAlpha               bool
	PluginsAppsSkipVerifyTLS         bool
	PluginSettings                   PluginSettings
	PluginsAllowUnsigned             []string
	DisableSanitizeHtml              bool
	EnterpriseLicensePath            string

	// Dashboards
	DefaultHomeDashboardPath string

	// Auth
	LoginCookieName              string
	LoginMaxInactiveLifetime     time.Duration
	LoginMaxLifetime             time.Duration
	TokenRotationIntervalMinutes int

	// OAuth
	OAuthCookieMaxAge int

	// SAML Auth
	SAMLEnabled bool

	// Dataproxy
	SendUserHeader bool

	// DistributedCache
	RemoteCacheOptions *RemoteCacheOptions

	EditorsCanAdmin bool

	ApiKeyMaxSecondsToLive int64

	// Use to enable new features which may still be in alpha/beta stage.
	FeatureToggles       map[string]bool
	AnonymousHideVersion bool

	DateFormats DateFormats

	// Annotations
	AlertingAnnotationCleanupSetting   AnnotationCleanupSettings
	DashboardAnnotationCleanupSettings AnnotationCleanupSettings
	APIAnnotationCleanupSettings       AnnotationCleanupSettings
}

// IsExpressionsEnabled returns whether the expressions feature is enabled.
func (c Cfg) IsExpressionsEnabled() bool {
	return c.FeatureToggles["expressions"]
}

// IsLiveEnabled returns if grafana live should be enabled
func (c Cfg) IsLiveEnabled() bool {
	return c.FeatureToggles["live"]
}

type CommandLineArgs struct {
	Config   string
	HomePath string
	Args     []string
}

func init() {
	IsWindows = runtime.GOOS == "windows"
}

func parseAppUrlAndSubUrl(section *ini.Section) (string, string, error) {
	appUrl := valueAsString(section, "root_url", "http://localhost:3000/")

	if appUrl[len(appUrl)-1] != '/' {
		appUrl += "/"
	}

	// Check if has app suburl.
	url, err := url.Parse(appUrl)
	if err != nil {
		log.Fatalf(4, "Invalid root_url(%s): %s", appUrl, err)
	}

	appSubUrl := strings.TrimSuffix(url.Path, "/")
	return appUrl, appSubUrl, nil
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
			envKey := envKey(section.Name(), key.Name())
			envValue := os.Getenv(envKey)

			if len(envValue) > 0 {
				key.SetValue(envValue)
				if shouldRedactKey(envKey) {
					envValue = redactedPassword
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

func (cfg *Cfg) readAnnotationSettings() {
	dashboardAnnotation := cfg.Raw.Section("annotations.dashboard")
	apiIAnnotation := cfg.Raw.Section("annotations.api")
	alertingSection := cfg.Raw.Section("alerting")

	var newAnnotationCleanupSettings = func(section *ini.Section, maxAgeField string) AnnotationCleanupSettings {
		maxAge, err := gtime.ParseInterval(section.Key(maxAgeField).MustString(""))
		if err != nil {
			maxAge = 0
		}

		return AnnotationCleanupSettings{
			MaxAge:   maxAge,
			MaxCount: section.Key("max_annotations_to_keep").MustInt64(0),
		}
	}

	cfg.AlertingAnnotationCleanupSetting = newAnnotationCleanupSettings(alertingSection, "max_annotation_age")
	cfg.DashboardAnnotationCleanupSettings = newAnnotationCleanupSettings(dashboardAnnotation, "max_age")
	cfg.APIAnnotationCleanupSettings = newAnnotationCleanupSettings(apiIAnnotation, "max_age")
}

type AnnotationCleanupSettings struct {
	MaxAge   time.Duration
	MaxCount int64
}

func envKey(sectionName string, keyName string) string {
	sN := strings.ToUpper(strings.ReplaceAll(sectionName, ".", "_"))
	sN = strings.ReplaceAll(sN, "-", "_")
	kN := strings.ToUpper(strings.ReplaceAll(keyName, ".", "_"))
	envKey := fmt.Sprintf("GF_%s_%s", sN, kN)
	return envKey
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
					value = redactedPassword
				}
				appliedCommandLineProperties = append(appliedCommandLineProperties, fmt.Sprintf("%s=%s", keyString, value))
			}
		}
	}
}

func applyCommandLineProperties(props map[string]string, file *ini.File) {
	for _, section := range file.Sections() {
		sectionName := section.Name() + "."
		if section.Name() == ini.DefaultSection {
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
			log.Fatalf(3, "Invalid command line argument. argument: %v", arg)
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

func loadSpecifiedConfigFile(configFile string, masterFile *ini.File) error {
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
		fmt.Printf("Failed to parse defaults.ini, %v\n", err)
		os.Exit(1)
		return nil, err
	}

	parsedFile.BlockMode = false

	// command line props
	commandLineProps := getCommandLineProperties(args.Args)
	// load default overrides
	applyCommandLineDefaultProperties(commandLineProps, parsedFile)

	// load specified config file
	err = loadSpecifiedConfigFile(args.Config, parsedFile)
	if err != nil {
		err2 := cfg.initLogging(parsedFile)
		if err2 != nil {
			return nil, err2
		}
		log.Fatalf(3, err.Error())
	}

	// apply environment overrides
	err = applyEnvVariableOverrides(parsedFile)
	if err != nil {
		return nil, err
	}

	// apply command line overrides
	applyCommandLineProperties(commandLineProps, parsedFile)

	// evaluate config values containing environment variables
	err = expandConfig(parsedFile)
	if err != nil {
		return nil, err
	}

	// update data path and logging config
	dataPath := valueAsString(parsedFile.Section("paths"), "data", "")

	cfg.DataPath = makeAbsolute(dataPath, HomePath)
	err = cfg.initLogging(parsedFile)
	if err != nil {
		return nil, err
	}

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

func NewCfg() *Cfg {
	return &Cfg{
		Logger: log.New("settings"),
		Raw:    ini.Empty(),
	}
}

func (cfg *Cfg) validateStaticRootPath() error {
	if skipStaticRootValidation {
		return nil
	}

	if _, err := os.Stat(path.Join(StaticRootPath, "build")); err != nil {
		cfg.Logger.Error("Failed to detect generated javascript files in public/build")
	}

	return nil
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

	cfg.BuildVersion = BuildVersion
	cfg.BuildCommit = BuildCommit
	cfg.BuildStamp = BuildStamp
	cfg.BuildBranch = BuildBranch
	cfg.IsEnterprise = IsEnterprise
	cfg.Packaging = Packaging

	ApplicationName = "Grafana"

	Env = valueAsString(iniFile.Section(""), "app_mode", "development")
	InstanceName = valueAsString(iniFile.Section(""), "instance_name", "unknown_instance_name")
	plugins := valueAsString(iniFile.Section("paths"), "plugins", "")
	PluginsPath = makeAbsolute(plugins, HomePath)
	cfg.BundledPluginsPath = makeAbsolute("plugins-bundled", HomePath)
	provisioning := valueAsString(iniFile.Section("paths"), "provisioning", "")
	cfg.ProvisioningPath = makeAbsolute(provisioning, HomePath)

	if err := readServerSettings(iniFile, cfg); err != nil {
		return err
	}

	// read data proxy settings
	dataproxy := iniFile.Section("dataproxy")
	DataProxyLogging = dataproxy.Key("logging").MustBool(false)
	DataProxyTimeout = dataproxy.Key("timeout").MustInt(30)
	cfg.SendUserHeader = dataproxy.Key("send_user_header").MustBool(false)

	if err := readSecuritySettings(iniFile, cfg); err != nil {
		return err
	}

	if err := readSnapshotsSettings(iniFile); err != nil {
		return err
	}

	// read dashboard settings
	dashboards := iniFile.Section("dashboards")
	DashboardVersionsToKeep = dashboards.Key("versions_to_keep").MustInt(20)
	MinRefreshInterval = valueAsString(dashboards, "min_refresh_interval", "5s")

	cfg.DefaultHomeDashboardPath = dashboards.Key("default_home_dashboard_path").MustString("")

	if err := readUserSettings(iniFile, cfg); err != nil {
		return err
	}
	if err := readAuthSettings(iniFile, cfg); err != nil {
		return err
	}
	if err := readRenderingSettings(iniFile, cfg); err != nil {
		return err
	}

	cfg.TempDataLifetime = iniFile.Section("paths").Key("temp_data_lifetime").MustDuration(time.Second * 3600 * 24)
	cfg.MetricsEndpointEnabled = iniFile.Section("metrics").Key("enabled").MustBool(true)
	cfg.MetricsEndpointBasicAuthUsername = valueAsString(iniFile.Section("metrics"), "basic_auth_username", "")
	cfg.MetricsEndpointBasicAuthPassword = valueAsString(iniFile.Section("metrics"), "basic_auth_password", "")
	cfg.MetricsEndpointDisableTotalStats = iniFile.Section("metrics").Key("disable_total_stats").MustBool(false)

	analytics := iniFile.Section("analytics")
	ReportingEnabled = analytics.Key("reporting_enabled").MustBool(true)
	CheckForUpdates = analytics.Key("check_for_updates").MustBool(true)
	GoogleAnalyticsId = analytics.Key("google_analytics_ua_id").String()
	GoogleTagManagerId = analytics.Key("google_tag_manager_id").String()

	if err := readAlertingSettings(iniFile); err != nil {
		return err
	}

	explore := iniFile.Section("explore")
	ExploreEnabled = explore.Key("enabled").MustBool(true)

	panelsSection := iniFile.Section("panels")
	cfg.DisableSanitizeHtml = panelsSection.Key("disable_sanitize_html").MustBool(false)

	pluginsSection := iniFile.Section("plugins")
	cfg.PluginsEnableAlpha = pluginsSection.Key("enable_alpha").MustBool(false)
	cfg.PluginsAppsSkipVerifyTLS = pluginsSection.Key("app_tls_skip_verify_insecure").MustBool(false)
	cfg.PluginSettings = extractPluginSettings(iniFile.Sections())
	pluginsAllowUnsigned := pluginsSection.Key("allow_loading_unsigned_plugins").MustString("")
	for _, plug := range strings.Split(pluginsAllowUnsigned, ",") {
		plug = strings.TrimSpace(plug)
		cfg.PluginsAllowUnsigned = append(cfg.PluginsAllowUnsigned, plug)
	}
	cfg.Protocol = Protocol

	// Read and populate feature toggles list
	featureTogglesSection := iniFile.Section("feature_toggles")
	cfg.FeatureToggles = make(map[string]bool)
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		cfg.FeatureToggles[feature] = true
	}

	// check old location for this option
	if panelsSection.Key("enable_alpha").MustBool(false) {
		cfg.PluginsEnableAlpha = true
	}

	cfg.readLDAPConfig()
	cfg.readSessionConfig()
	cfg.readSmtpSettings()
	cfg.readQuotaSettings()
	cfg.readAnnotationSettings()

	if VerifyEmailEnabled && !cfg.Smtp.Enabled {
		log.Warnf("require_email_validation is enabled but smtp is disabled")
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
	dbName := valueAsString(cacheServer, "type", "database")
	connStr := valueAsString(cacheServer, "connstr", "")

	cfg.RemoteCacheOptions = &RemoteCacheOptions{
		Name:    dbName,
		ConnStr: connStr,
	}

	cfg.readDateFormats()

	return nil
}

func valueAsString(section *ini.Section, keyName string, defaultValue string) string {
	return section.Key(keyName).MustString(defaultValue)
}

type RemoteCacheOptions struct {
	Name    string
	ConnStr string
}

func (cfg *Cfg) readLDAPConfig() {
	ldapSec := cfg.Raw.Section("auth.ldap")
	LDAPConfigFile = ldapSec.Key("config_file").String()
	LDAPSyncCron = ldapSec.Key("sync_cron").String()
	LDAPEnabled = ldapSec.Key("enabled").MustBool(false)
	LDAPActiveSyncEnabled = ldapSec.Key("active_sync_enabled").MustBool(false)
	LDAPAllowSignup = ldapSec.Key("allow_sign_up").MustBool(true)
}

func (cfg *Cfg) readSessionConfig() {
	sec, _ := cfg.Raw.GetSection("session")

	if sec != nil {
		cfg.Logger.Warn(
			"[Removed] Session setting was removed in v6.2, use remote_cache option instead",
		)
	}
}

func (cfg *Cfg) initLogging(file *ini.File) error {
	logModeStr := valueAsString(file.Section("log"), "mode", "console")
	// split on comma
	logModes := strings.Split(logModeStr, ",")
	// also try space
	if len(logModes) == 1 {
		logModes = strings.Split(logModeStr, " ")
	}
	logsPath := valueAsString(file.Section("paths"), "logs", "")
	cfg.LogsPath = makeAbsolute(logsPath, HomePath)
	return log.ReadLoggingConfig(logModes, cfg.LogsPath, file)
}

func (cfg *Cfg) LogConfigSources() {
	var text bytes.Buffer

	for _, file := range configFiles {
		cfg.Logger.Info("Config loaded from", "file", file)
	}

	if len(appliedCommandLineProperties) > 0 {
		for _, prop := range appliedCommandLineProperties {
			cfg.Logger.Info("Config overridden from command line", "arg", prop)
		}
	}

	if len(appliedEnvOverrides) > 0 {
		text.WriteString("\tEnvironment variables used:\n")
		for _, prop := range appliedEnvOverrides {
			cfg.Logger.Info("Config overridden from Environment variable", "var", prop)
		}
	}

	cfg.Logger.Info("Path Home", "path", HomePath)
	cfg.Logger.Info("Path Data", "path", cfg.DataPath)
	cfg.Logger.Info("Path Logs", "path", cfg.LogsPath)
	cfg.Logger.Info("Path Plugins", "path", PluginsPath)
	cfg.Logger.Info("Path Provisioning", "path", cfg.ProvisioningPath)
	cfg.Logger.Info("App mode " + Env)
}

type DynamicSection struct {
	section *ini.Section
	Logger  log.Logger
}

// Key dynamically overrides keys with environment variables.
// As a side effect, the value of the setting key will be updated if an environment variable is present.
func (s *DynamicSection) Key(k string) *ini.Key {
	envKey := envKey(s.section.Name(), k)
	envValue := os.Getenv(envKey)
	key := s.section.Key(k)

	if len(envValue) == 0 {
		return key
	}

	key.SetValue(envValue)
	if shouldRedactKey(envKey) {
		envValue = redactedPassword
	}
	s.Logger.Info("Config overridden from Environment variable", "var", fmt.Sprintf("%s=%s", envKey, envValue))

	return key
}

// SectionWithEnvOverrides dynamically overrides keys with environment variables.
// As a side effect, the value of the setting key will be updated if an environment variable is present.
func (cfg *Cfg) SectionWithEnvOverrides(s string) *DynamicSection {
	return &DynamicSection{cfg.Raw.Section(s), cfg.Logger}
}

func readSecuritySettings(iniFile *ini.File, cfg *Cfg) error {
	security := iniFile.Section("security")
	SecretKey = valueAsString(security, "secret_key", "")
	DisableGravatar = security.Key("disable_gravatar").MustBool(true)
	cfg.DisableBruteForceLoginProtection = security.Key("disable_brute_force_login_protection").MustBool(false)
	DisableBruteForceLoginProtection = cfg.DisableBruteForceLoginProtection

	CookieSecure = security.Key("cookie_secure").MustBool(false)
	cfg.CookieSecure = CookieSecure

	samesiteString := valueAsString(security, "cookie_samesite", "lax")

	if samesiteString == "disabled" {
		CookieSameSiteDisabled = true
		cfg.CookieSameSiteDisabled = CookieSameSiteDisabled
	} else {
		validSameSiteValues := map[string]http.SameSite{
			"lax":    http.SameSiteLaxMode,
			"strict": http.SameSiteStrictMode,
			"none":   http.SameSiteNoneMode,
		}

		if samesite, ok := validSameSiteValues[samesiteString]; ok {
			CookieSameSiteMode = samesite
			cfg.CookieSameSiteMode = CookieSameSiteMode
		} else {
			CookieSameSiteMode = http.SameSiteLaxMode
			cfg.CookieSameSiteMode = CookieSameSiteMode
		}
	}
	AllowEmbedding = security.Key("allow_embedding").MustBool(false)

	ContentTypeProtectionHeader = security.Key("x_content_type_options").MustBool(true)
	XSSProtectionHeader = security.Key("x_xss_protection").MustBool(true)
	StrictTransportSecurity = security.Key("strict_transport_security").MustBool(false)
	StrictTransportSecurityMaxAge = security.Key("strict_transport_security_max_age_seconds").MustInt(86400)
	StrictTransportSecurityPreload = security.Key("strict_transport_security_preload").MustBool(false)
	StrictTransportSecuritySubDomains = security.Key("strict_transport_security_subdomains").MustBool(false)

	// read data source proxy whitelist
	DataProxyWhiteList = make(map[string]bool)
	securityStr := valueAsString(security, "data_source_proxy_whitelist", "")

	for _, hostAndIP := range util.SplitString(securityStr) {
		DataProxyWhiteList[hostAndIP] = true
	}

	// admin
	cfg.DisableInitAdminCreation = security.Key("disable_initial_admin_creation").MustBool(false)
	AdminUser = valueAsString(security, "admin_user", "")
	AdminPassword = valueAsString(security, "admin_password", "")

	return nil
}

func readAuthSettings(iniFile *ini.File, cfg *Cfg) (err error) {
	auth := iniFile.Section("auth")

	LoginCookieName = valueAsString(auth, "login_cookie_name", "grafana_session")
	cfg.LoginCookieName = LoginCookieName
	maxInactiveDaysVal := auth.Key("login_maximum_inactive_lifetime_days").MustString("")
	if maxInactiveDaysVal != "" {
		maxInactiveDaysVal = fmt.Sprintf("%sd", maxInactiveDaysVal)
		cfg.Logger.Warn("[Deprecated] the configuration setting 'login_maximum_inactive_lifetime_days' is deprecated, please use 'login_maximum_inactive_lifetime_duration' instead")
	} else {
		maxInactiveDaysVal = "7d"
	}
	maxInactiveDurationVal := valueAsString(auth, "login_maximum_inactive_lifetime_duration", maxInactiveDaysVal)
	cfg.LoginMaxInactiveLifetime, err = gtime.ParseInterval(maxInactiveDurationVal)
	if err != nil {
		return err
	}

	maxLifetimeDaysVal := auth.Key("login_maximum_lifetime_days").MustString("")
	if maxLifetimeDaysVal != "" {
		maxLifetimeDaysVal = fmt.Sprintf("%sd", maxLifetimeDaysVal)
		cfg.Logger.Warn("[Deprecated] the configuration setting 'login_maximum_lifetime_days' is deprecated, please use 'login_maximum_lifetime_duration' instead")
	} else {
		maxLifetimeDaysVal = "7d"
	}
	maxLifetimeDurationVal := valueAsString(auth, "login_maximum_lifetime_duration", maxLifetimeDaysVal)
	cfg.LoginMaxLifetime, err = gtime.ParseInterval(maxLifetimeDurationVal)
	if err != nil {
		return err
	}
	LoginMaxLifetime = cfg.LoginMaxLifetime

	cfg.ApiKeyMaxSecondsToLive = auth.Key("api_key_max_seconds_to_live").MustInt64(-1)

	cfg.TokenRotationIntervalMinutes = auth.Key("token_rotation_interval_minutes").MustInt(10)
	if cfg.TokenRotationIntervalMinutes < 2 {
		cfg.TokenRotationIntervalMinutes = 2
	}

	DisableLoginForm = auth.Key("disable_login_form").MustBool(false)
	DisableSignoutMenu = auth.Key("disable_signout_menu").MustBool(false)
	OAuthAutoLogin = auth.Key("oauth_auto_login").MustBool(false)
	cfg.OAuthCookieMaxAge = auth.Key("oauth_state_cookie_max_age").MustInt(600)
	SignoutRedirectUrl = valueAsString(auth, "signout_redirect_url", "")

	// SAML auth
	cfg.SAMLEnabled = iniFile.Section("auth.saml").Key("enabled").MustBool(false)

	// anonymous access
	AnonymousEnabled = iniFile.Section("auth.anonymous").Key("enabled").MustBool(false)
	AnonymousOrgName = valueAsString(iniFile.Section("auth.anonymous"), "org_name", "")
	AnonymousOrgRole = valueAsString(iniFile.Section("auth.anonymous"), "org_role", "")
	cfg.AnonymousHideVersion = iniFile.Section("auth.anonymous").Key("hide_version").MustBool(false)

	// basic auth
	authBasic := iniFile.Section("auth.basic")
	BasicAuthEnabled = authBasic.Key("enabled").MustBool(true)

	authProxy := iniFile.Section("auth.proxy")
	AuthProxyEnabled = authProxy.Key("enabled").MustBool(false)

	AuthProxyHeaderName = valueAsString(authProxy, "header_name", "")
	AuthProxyHeaderProperty = valueAsString(authProxy, "header_property", "")
	AuthProxyAutoSignUp = authProxy.Key("auto_sign_up").MustBool(true)
	AuthProxyEnableLoginToken = authProxy.Key("enable_login_token").MustBool(false)

	ldapSyncVal := authProxy.Key("ldap_sync_ttl").MustInt()
	syncVal := authProxy.Key("sync_ttl").MustInt()

	if ldapSyncVal != AuthProxySyncTTL {
		AuthProxySyncTtl = ldapSyncVal
		cfg.Logger.Warn("[Deprecated] the configuration setting 'ldap_sync_ttl' is deprecated, please use 'sync_ttl' instead")
	} else {
		AuthProxySyncTtl = syncVal
	}

	AuthProxyWhitelist = valueAsString(authProxy, "whitelist", "")

	AuthProxyHeaders = make(map[string]string)
	headers := valueAsString(authProxy, "headers", "")

	for _, propertyAndHeader := range util.SplitString(headers) {
		split := strings.SplitN(propertyAndHeader, ":", 2)
		if len(split) == 2 {
			AuthProxyHeaders[split[0]] = split[1]
		}
	}

	return nil
}

func readUserSettings(iniFile *ini.File, cfg *Cfg) error {
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

	return nil
}

func readRenderingSettings(iniFile *ini.File, cfg *Cfg) error {
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
			// XXX: Should return an error?
			log.Fatalf(4, "Invalid callback_url(%s): %s", cfg.RendererCallbackUrl, err)
		}
	}

	cfg.RendererConcurrentRequestLimit = renderSec.Key("concurrent_render_request_limit").MustInt(30)
	cfg.ImagesDir = filepath.Join(cfg.DataPath, "png")

	return nil
}

func readAlertingSettings(iniFile *ini.File) error {
	alerting := iniFile.Section("alerting")
	AlertingEnabled = alerting.Key("enabled").MustBool(true)
	ExecuteAlerts = alerting.Key("execute_alerts").MustBool(true)
	AlertingRenderLimit = alerting.Key("concurrent_render_limit").MustInt(5)

	AlertingErrorOrTimeout = valueAsString(alerting, "error_or_timeout", "alerting")
	AlertingNoDataOrNullValues = valueAsString(alerting, "nodata_or_nullvalues", "no_data")

	evaluationTimeoutSeconds := alerting.Key("evaluation_timeout_seconds").MustInt64(30)
	AlertingEvaluationTimeout = time.Second * time.Duration(evaluationTimeoutSeconds)
	notificationTimeoutSeconds := alerting.Key("notification_timeout_seconds").MustInt64(30)
	AlertingNotificationTimeout = time.Second * time.Duration(notificationTimeoutSeconds)
	AlertingMaxAttempts = alerting.Key("max_attempts").MustInt(3)
	AlertingMinInterval = alerting.Key("min_interval_seconds").MustInt64(1)

	return nil
}

func readSnapshotsSettings(iniFile *ini.File) error {
	snapshots := iniFile.Section("snapshots")

	ExternalSnapshotUrl = valueAsString(snapshots, "external_snapshot_url", "")
	ExternalSnapshotName = valueAsString(snapshots, "external_snapshot_name", "")

	ExternalEnabled = snapshots.Key("external_enabled").MustBool(true)
	SnapShotRemoveExpired = snapshots.Key("snapshot_remove_expired").MustBool(true)
	SnapshotPublicMode = snapshots.Key("public_mode").MustBool(false)

	return nil
}

func readServerSettings(iniFile *ini.File, cfg *Cfg) error {
	server := iniFile.Section("server")
	var err error
	AppUrl, AppSubUrl, err = parseAppUrlAndSubUrl(server)
	if err != nil {
		return err
	}
	ServeFromSubPath = server.Key("serve_from_sub_path").MustBool(false)

	cfg.AppUrl = AppUrl
	cfg.AppSubUrl = AppSubUrl
	cfg.ServeFromSubPath = ServeFromSubPath

	Protocol = HTTPScheme
	protocolStr := valueAsString(server, "protocol", "http")

	if protocolStr == "https" {
		Protocol = HTTPSScheme
		CertFile = server.Key("cert_file").String()
		KeyFile = server.Key("cert_key").String()
	}
	if protocolStr == "h2" {
		Protocol = HTTP2Scheme
		CertFile = server.Key("cert_file").String()
		KeyFile = server.Key("cert_key").String()
	}
	if protocolStr == "socket" {
		Protocol = SocketScheme
		SocketPath = server.Key("socket").String()
	}

	Domain = valueAsString(server, "domain", "localhost")
	HttpAddr = valueAsString(server, "http_addr", DefaultHTTPAddr)
	HttpPort = valueAsString(server, "http_port", "3000")
	RouterLogging = server.Key("router_logging").MustBool(false)

	EnableGzip = server.Key("enable_gzip").MustBool(false)
	EnforceDomain = server.Key("enforce_domain").MustBool(false)
	staticRoot := valueAsString(server, "static_root_path", "")
	StaticRootPath = makeAbsolute(staticRoot, HomePath)
	cfg.StaticRootPath = StaticRootPath

	if err := cfg.validateStaticRootPath(); err != nil {
		return err
	}

	return nil
}

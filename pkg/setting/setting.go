// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package setting

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gobwas/glob"
	"github.com/prometheus/common/model"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

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
	RedactedPassword = "*********"
	DefaultHTTPAddr  = "0.0.0.0"
	Dev              = "development"
	Prod             = "production"
	Test             = "test"
	ApplicationName  = "Grafana"
)

// zoneInfo names environment variable for setting the path to look for the timezone database in go
const zoneInfo = "ZONEINFO"

var (
	// App settings.
	Env              = Dev
	AppUrl           string
	AppSubUrl        string
	ServeFromSubPath bool
	InstanceName     string

	// build
	BuildVersion string
	BuildCommit  string
	BuildBranch  string
	BuildStamp   int64
	IsEnterprise bool

	// packaging
	Packaging = "unknown"

	// Paths
	HomePath       string
	CustomInitPath = "conf/custom.ini"

	// HTTP server options
	StaticRootPath string

	// Security settings.
	SecretKey              string
	DisableGravatar        bool
	DataProxyWhiteList     map[string]bool
	CookieSecure           bool
	CookieSameSiteDisabled bool
	CookieSameSiteMode     http.SameSite

	// Dashboard history
	DashboardVersionsToKeep int
	MinRefreshInterval      string

	// User settings
	AllowUserSignUp         bool
	AllowUserOrgCreate      bool
	VerifyEmailEnabled      bool
	LoginHint               string
	PasswordHint            string
	DisableSignoutMenu      bool
	SignoutRedirectUrl      string
	ExternalUserMngLinkUrl  string
	ExternalUserMngLinkName string
	ExternalUserMngInfo     string

	// HTTP auth
	SigV4AuthEnabled bool
	AzureAuthEnabled bool

	// Global setting objects.
	Raw *ini.File

	// for logging purposes
	configFiles                  []string
	appliedCommandLineProperties []string
	appliedEnvOverrides          []string

	// Alerting
	AlertingEnabled            *bool
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

	// Help UI
	HelpEnabled bool

	// Profile UI
	ProfileEnabled bool

	// Grafana.NET URL
	GrafanaComUrl string

	ImageUploadProvider string
)

// TODO move all global vars to this struct
type Cfg struct {
	Target []string
	Raw    *ini.File
	Logger log.Logger

	// HTTP Server Settings
	CertFile         string
	KeyFile          string
	HTTPAddr         string
	HTTPPort         string
	AppURL           string
	AppSubURL        string
	ServeFromSubPath bool
	StaticRootPath   string
	Protocol         Scheme
	SocketGid        int
	SocketMode       int
	SocketPath       string
	RouterLogging    bool
	Domain           string
	CDNRootURL       *url.URL
	ReadTimeout      time.Duration
	EnableGzip       bool
	EnforceDomain    bool

	// Security settings
	SecretKey             string
	EmailCodeValidMinutes int

	// build
	BuildVersion string
	BuildCommit  string
	BuildBranch  string
	BuildStamp   int64
	IsEnterprise bool

	// packaging
	Packaging string

	// Paths
	HomePath              string
	ProvisioningPath      string
	DataPath              string
	LogsPath              string
	PluginsPath           string
	BundledPluginsPath    string
	EnterpriseLicensePath string

	// SMTP email settings
	Smtp SmtpSettings

	// Rendering
	ImagesDir                      string
	CSVsDir                        string
	RendererUrl                    string
	RendererCallbackUrl            string
	RendererAuthToken              string
	RendererConcurrentRequestLimit int
	RendererRenderKeyLifeTime      time.Duration

	// Security
	DisableInitAdminCreation          bool
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
	// CSPEnabled toggles Content Security Policy support.
	CSPEnabled bool
	// CSPTemplate contains the Content Security Policy template.
	CSPTemplate string
	// CSPReportEnabled toggles Content Security Policy Report Only support.
	CSPReportOnlyEnabled bool
	// CSPReportOnlyTemplate contains the Content Security Policy Report Only template.
	CSPReportOnlyTemplate string
	AngularSupportEnabled bool

	TempDataLifetime time.Duration

	// Plugins
	PluginsEnableAlpha               bool
	PluginsAppsSkipVerifyTLS         bool
	PluginSettings                   PluginSettings
	PluginsAllowUnsigned             []string
	PluginCatalogURL                 string
	PluginCatalogHiddenPlugins       []string
	PluginAdminEnabled               bool
	PluginAdminExternalManageEnabled bool

	PluginsCDNURLTemplate    string
	PluginLogBackendRequests bool

	// Panels
	DisableSanitizeHtml bool

	// Metrics
	MetricsEndpointEnabled           bool
	MetricsEndpointBasicAuthUsername string
	MetricsEndpointBasicAuthPassword string
	MetricsEndpointDisableTotalStats bool
	MetricsGrafanaEnvironmentInfo    map[string]string

	// Dashboards
	DefaultHomeDashboardPath string

	// Auth
	LoginCookieName              string
	LoginMaxInactiveLifetime     time.Duration
	LoginMaxLifetime             time.Duration
	TokenRotationIntervalMinutes int
	SigV4AuthEnabled             bool
	SigV4VerboseLogging          bool
	AzureAuthEnabled             bool
	AzureSkipOrgRoleSync         bool
	BasicAuthEnabled             bool
	AdminUser                    string
	AdminPassword                string
	DisableLogin                 bool
	AdminEmail                   string
	DisableSyncLock              bool
	DisableLoginForm             bool

	// AWS Plugin Auth
	AWSAllowedAuthProviders []string
	AWSAssumeRoleEnabled    bool
	AWSListMetricsPageLimit int

	// Azure Cloud settings
	Azure *azsettings.AzureSettings

	// Auth proxy settings
	AuthProxyEnabled          bool
	AuthProxyHeaderName       string
	AuthProxyHeaderProperty   string
	AuthProxyAutoSignUp       bool
	AuthProxyEnableLoginToken bool
	AuthProxyWhitelist        string
	AuthProxyHeaders          map[string]string
	AuthProxyHeadersEncoded   bool
	AuthProxySyncTTL          int

	// OAuth
	OAuthAutoLogin    bool
	OAuthCookieMaxAge int

	// JWT Auth
	JWTAuthEnabled                 bool
	JWTAuthHeaderName              string
	JWTAuthURLLogin                bool
	JWTAuthEmailClaim              string
	JWTAuthUsernameClaim           string
	JWTAuthExpectClaims            string
	JWTAuthJWKSetURL               string
	JWTAuthCacheTTL                time.Duration
	JWTAuthKeyFile                 string
	JWTAuthJWKSetFile              string
	JWTAuthAutoSignUp              bool
	JWTAuthRoleAttributePath       string
	JWTAuthRoleAttributeStrict     bool
	JWTAuthAllowAssignGrafanaAdmin bool
	JWTAuthSkipOrgRoleSync         bool

	// Dataproxy
	SendUserHeader                 bool
	DataProxyLogging               bool
	DataProxyTimeout               int
	DataProxyDialTimeout           int
	DataProxyTLSHandshakeTimeout   int
	DataProxyExpectContinueTimeout int
	DataProxyMaxConnsPerHost       int
	DataProxyMaxIdleConns          int
	DataProxyKeepAlive             int
	DataProxyIdleConnTimeout       int
	ResponseLimit                  int64
	DataProxyRowLimit              int64
	DataProxyUserAgent             string

	// DistributedCache
	RemoteCacheOptions *RemoteCacheOptions

	ViewersCanEdit  bool
	EditorsCanAdmin bool

	ApiKeyMaxSecondsToLive int64

	// Check if a feature toggle is enabled
	// @deprecated
	IsFeatureToggleEnabled func(key string) bool // filled in dynamically

	AnonymousEnabled     bool
	AnonymousOrgName     string
	AnonymousOrgRole     string
	AnonymousHideVersion bool

	DateFormats DateFormats

	// User
	UserInviteMaxLifetime time.Duration
	HiddenUsers           map[string]struct{}
	CaseInsensitiveLogin  bool // Login and Email will be considered case insensitive

	// Service Accounts
	SATokenExpirationDayLimit int

	// Annotations
	AnnotationCleanupJobBatchSize      int64
	AnnotationMaximumTagsLength        int64
	AlertingAnnotationCleanupSetting   AnnotationCleanupSettings
	DashboardAnnotationCleanupSettings AnnotationCleanupSettings
	APIAnnotationCleanupSettings       AnnotationCleanupSettings

	// Sentry config
	Sentry Sentry

	// GrafanaJavascriptAgent config
	GrafanaJavascriptAgent GrafanaJavascriptAgent

	// Data sources
	DataSourceLimit int

	// Snapshots
	SnapshotEnabled       bool
	ExternalSnapshotUrl   string
	ExternalSnapshotName  string
	ExternalEnabled       bool
	SnapShotRemoveExpired bool

	SnapshotPublicMode bool

	ErrTemplateName string

	Env string

	ForceMigration bool

	// Analytics
	CheckForGrafanaUpdates              bool
	CheckForPluginUpdates               bool
	ReportingDistributor                string
	ReportingEnabled                    bool
	ApplicationInsightsConnectionString string
	ApplicationInsightsEndpointUrl      string
	FeedbackLinksEnabled                bool

	// Frontend analytics
	GoogleAnalyticsID                   string
	GoogleAnalytics4ID                  string
	GoogleAnalytics4SendManualPageViews bool
	GoogleTagManagerID                  string
	RudderstackDataPlaneURL             string
	RudderstackWriteKey                 string
	RudderstackSDKURL                   string
	RudderstackConfigURL                string
	IntercomSecret                      string

	// AzureAD
	AzureADEnabled         bool
	AzureADSkipOrgRoleSync bool

	// Google
	GoogleAuthEnabled     bool
	GoogleSkipOrgRoleSync bool

	// Gitlab
	GitLabAuthEnabled     bool
	GitLabSkipOrgRoleSync bool

	// Generic OAuth
	GenericOAuthAuthEnabled     bool
	GenericOAuthSkipOrgRoleSync bool

	// LDAP
	LDAPAuthEnabled       bool
	LDAPSkipOrgRoleSync   bool
	LDAPConfigFilePath    string
	LDAPAllowSignup       bool
	LDAPActiveSyncEnabled bool
	LDAPSyncCron          string

	DefaultTheme    string
	DefaultLanguage string
	HomePage        string

	Quota QuotaSettings

	AutoAssignOrg              bool
	AutoAssignOrgId            int
	AutoAssignOrgRole          string
	OAuthSkipOrgRoleUpdateSync bool

	// ExpressionsEnabled specifies whether expressions are enabled.
	ExpressionsEnabled bool

	ImageUploadProvider string

	// LiveMaxConnections is a maximum number of WebSocket connections to
	// Grafana Live ws endpoint (per Grafana server instance). 0 disables
	// Live, -1 means unlimited connections.
	LiveMaxConnections int
	// LiveHAEngine is a type of engine to use to achieve HA with Grafana Live.
	// Zero value means in-memory single node setup.
	LiveHAEngine string
	// LiveHAEngineAddress is a connection address for Live HA engine.
	LiveHAEngineAddress string
	// LiveAllowedOrigins is a set of origins accepted by Live. If not provided
	// then Live uses AppURL as the only allowed origin.
	LiveAllowedOrigins []string

	// GitHub OAuth
	GitHubAuthEnabled     bool
	GitHubSkipOrgRoleSync bool

	// Grafana.com URL, used for OAuth redirect.
	GrafanaComURL string
	// Grafana.com API URL. Can be set separately to GrafanaComURL
	// in case API is not publicly accessible.
	// Defaults to GrafanaComURL setting + "/api" if unset.
	GrafanaComAPIURL string
	// Grafana.com Auth enabled
	GrafanaComAuthEnabled bool
	// GrafanaComSkipOrgRoleSync can be set for
	// letting users set org roles from within Grafana and
	// skip the org roles coming from GrafanaCom
	GrafanaComSkipOrgRoleSync bool

	// Geomap base layer config
	GeomapDefaultBaseLayerConfig map[string]interface{}
	GeomapEnableCustomBaseLayers bool

	// Unified Alerting
	UnifiedAlerting UnifiedAlertingSettings

	// Query history
	QueryHistoryEnabled bool

	DashboardPreviews DashboardPreviewsSettings

	Storage StorageSettings

	Search SearchSettings

	SecureSocksDSProxy SecureSocksDSProxySettings

	// SAML Auth
	SAMLAuthEnabled     bool
	SAMLSkipOrgRoleSync bool

	// Okta OAuth
	OktaAuthEnabled     bool
	OktaSkipOrgRoleSync bool

	// OAuth2 Server
	OAuth2ServerEnabled            bool
	OAuth2ServerDefaultServerKeyID string

	// OAuth2Server supports the two recommended key types from the RFC https://www.rfc-editor.org/rfc/rfc7518#section-3.1: RS256 and ES256
	OAuth2ServerGeneratedKeyTypeForClient string
	OAuth2ServerAccessTokenLifespan       time.Duration

	// Access Control
	RBACEnabled         bool
	RBACPermissionCache bool
	// Enable Permission validation during role creation and provisioning
	RBACPermissionValidationEnabled bool
	// Reset basic roles permissions on start-up
	RBACResetBasicRoles bool
	// GRPC Server.
	GRPCServerNetwork   string
	GRPCServerAddress   string
	GRPCServerTLSConfig *tls.Config

	CustomResponseHeaders map[string]string
}

// AddChangePasswordLink returns if login form is disabled or not since
// the same intention can be used to hide both features.
func (cfg *Cfg) AddChangePasswordLink() bool {
	return !cfg.DisableLoginForm
}

type CommandLineArgs struct {
	Config   string
	HomePath string
	Args     []string
}

func (cfg Cfg) parseAppUrlAndSubUrl(section *ini.Section) (string, string, error) {
	appUrl := valueAsString(section, "root_url", "http://localhost:3000/")

	if appUrl[len(appUrl)-1] != '/' {
		appUrl += "/"
	}

	// Check if has app suburl.
	url, err := url.Parse(appUrl)
	if err != nil {
		cfg.Logger.Error("Invalid root_url.", "url", appUrl, "error", err)
		os.Exit(1)
	}

	appSubUrl := strings.TrimSuffix(url.Path, "/")
	return appUrl, appSubUrl, nil
}

func ToAbsUrl(relativeUrl string) string {
	return AppUrl + relativeUrl
}

func RedactedValue(key, value string) string {
	uppercased := strings.ToUpper(key)
	// Sensitive information: password, secrets etc
	for _, pattern := range []string{
		"PASSWORD",
		"SECRET",
		"PROVIDER_CONFIG",
		"PRIVATE_KEY",
		"SECRET_KEY",
		"CERTIFICATE",
		"ACCOUNT_KEY",
		"ENCRYPTION_KEY",
		"VAULT_TOKEN",
	} {
		if match, err := regexp.MatchString(pattern, uppercased); match && err == nil {
			return RedactedPassword
		}
	}

	for _, exception := range []string{
		"RUDDERSTACK",
		"APPLICATION_INSIGHTS",
		"SENTRY",
	} {
		if strings.Contains(uppercased, exception) {
			return value
		}
	}

	if u, err := RedactedURL(value); err == nil {
		return u
	}

	return value
}

func RedactedURL(value string) (string, error) {
	// Value could be a list of URLs
	chunks := util.SplitString(value)

	for i, chunk := range chunks {
		var hasTmpPrefix bool
		const tmpPrefix = "http://"

		if !strings.Contains(chunk, "://") {
			chunk = tmpPrefix + chunk
			hasTmpPrefix = true
		}

		u, err := url.Parse(chunk)
		if err != nil {
			return "", err
		}

		redacted := u.Redacted()
		if hasTmpPrefix {
			redacted = strings.Replace(redacted, tmpPrefix, "", 1)
		}

		chunks[i] = redacted
	}

	if strings.Contains(value, ",") {
		return strings.Join(chunks, ","), nil
	}

	return strings.Join(chunks, " "), nil
}

func applyEnvVariableOverrides(file *ini.File) error {
	appliedEnvOverrides = make([]string, 0)
	for _, section := range file.Sections() {
		for _, key := range section.Keys() {
			envKey := EnvKey(section.Name(), key.Name())
			envValue := os.Getenv(envKey)

			if len(envValue) > 0 {
				key.SetValue(envValue)
				appliedEnvOverrides = append(appliedEnvOverrides, fmt.Sprintf("%s=%s", envKey, RedactedValue(envKey, envValue)))
			}
		}
	}

	return nil
}

func (cfg *Cfg) readGrafanaEnvironmentMetrics() error {
	environmentMetricsSection := cfg.Raw.Section("metrics.environment_info")
	keys := environmentMetricsSection.Keys()
	cfg.MetricsGrafanaEnvironmentInfo = make(map[string]string, len(keys))

	for _, key := range keys {
		labelName := model.LabelName(key.Name())
		labelValue := model.LabelValue(key.Value())

		if !labelName.IsValid() {
			return fmt.Errorf("invalid label name in [metrics.environment_info] configuration. name %q", labelName)
		}

		if !labelValue.IsValid() {
			return fmt.Errorf("invalid label value in [metrics.environment_info] configuration. name %q value %q", labelName, labelValue)
		}

		cfg.MetricsGrafanaEnvironmentInfo[string(labelName)] = string(labelValue)
	}

	return nil
}

func (cfg *Cfg) readAnnotationSettings() error {
	section := cfg.Raw.Section("annotations")
	cfg.AnnotationCleanupJobBatchSize = section.Key("cleanupjob_batchsize").MustInt64(100)
	cfg.AnnotationMaximumTagsLength = section.Key("tags_length").MustInt64(500)
	switch {
	case cfg.AnnotationMaximumTagsLength > 4096:
		// ensure that the configuration does not exceed the respective column size
		return fmt.Errorf("[annotations.tags_length] configuration exceeds the maximum allowed (4096)")
	case cfg.AnnotationMaximumTagsLength > 500:
		cfg.Logger.Info("[annotations.tags_length] has been increased from its default value; this may affect the performance", "tagLength", cfg.AnnotationMaximumTagsLength)
	case cfg.AnnotationMaximumTagsLength < 500:
		cfg.Logger.Warn("[annotations.tags_length] is too low; the minimum allowed (500) is enforced")
		cfg.AnnotationMaximumTagsLength = 500
	}

	dashboardAnnotation := cfg.Raw.Section("annotations.dashboard")
	apiIAnnotation := cfg.Raw.Section("annotations.api")
	alertingSection := cfg.Raw.Section("alerting")

	var newAnnotationCleanupSettings = func(section *ini.Section, maxAgeField string) AnnotationCleanupSettings {
		maxAge, err := gtime.ParseDuration(section.Key(maxAgeField).MustString(""))
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

	return nil
}

func (cfg *Cfg) readExpressionsSettings() {
	expressions := cfg.Raw.Section("expressions")
	cfg.ExpressionsEnabled = expressions.Key("enabled").MustBool(true)
}

type AnnotationCleanupSettings struct {
	MaxAge   time.Duration
	MaxCount int64
}

func EnvKey(sectionName string, keyName string) string {
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
				appliedCommandLineProperties = append(appliedCommandLineProperties,
					fmt.Sprintf("%s=%s", keyString, RedactedValue(keyString, value)))
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

func (cfg Cfg) getCommandLineProperties(args []string) map[string]string {
	props := make(map[string]string)

	for _, arg := range args {
		if !strings.HasPrefix(arg, "cfg:") {
			continue
		}

		trimmed := strings.TrimPrefix(arg, "cfg:")
		parts := strings.Split(trimmed, "=")
		if len(parts) != 2 {
			cfg.Logger.Error("Invalid command line argument.", "argument", arg)
			os.Exit(1)
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

func (cfg *Cfg) loadSpecifiedConfigFile(configFile string, masterFile *ini.File) error {
	if configFile == "" {
		configFile = filepath.Join(cfg.HomePath, CustomInitPath)
		// return without error if custom file does not exist
		if !pathExists(configFile) {
			return nil
		}
	}

	userConfig, err := ini.Load(configFile)
	if err != nil {
		return fmt.Errorf("failed to parse %q: %w", configFile, err)
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

func (cfg *Cfg) loadConfiguration(args CommandLineArgs) (*ini.File, error) {
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
	commandLineProps := cfg.getCommandLineProperties(args.Args)
	// load default overrides
	applyCommandLineDefaultProperties(commandLineProps, parsedFile)

	// load specified config file
	err = cfg.loadSpecifiedConfigFile(args.Config, parsedFile)
	if err != nil {
		err2 := cfg.initLogging(parsedFile)
		if err2 != nil {
			return nil, err2
		}
		cfg.Logger.Error(err.Error())
		os.Exit(1)
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

	cfg.Logger.Info(fmt.Sprintf("Starting %s", ApplicationName), "version", BuildVersion, "commit", BuildCommit, "branch", BuildBranch, "compiled", time.Unix(BuildStamp, 0))

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

func (cfg *Cfg) setHomePath(args CommandLineArgs) {
	if args.HomePath != "" {
		cfg.HomePath = args.HomePath
		HomePath = cfg.HomePath
		return
	}

	var err error
	cfg.HomePath, err = filepath.Abs(".")
	if err != nil {
		panic(err)
	}

	HomePath = cfg.HomePath
	// check if homepath is correct
	if pathExists(filepath.Join(cfg.HomePath, "conf/defaults.ini")) {
		return
	}

	// try down one path
	if pathExists(filepath.Join(cfg.HomePath, "../conf/defaults.ini")) {
		cfg.HomePath = filepath.Join(cfg.HomePath, "../")
		HomePath = cfg.HomePath
	}
}

var skipStaticRootValidation = false

func NewCfg() *Cfg {
	return &Cfg{
		Target:      []string{"all"},
		Logger:      log.New("settings"),
		Raw:         ini.Empty(),
		Azure:       &azsettings.AzureSettings{},
		RBACEnabled: true,
	}
}

func NewCfgFromArgs(args CommandLineArgs) (*Cfg, error) {
	cfg := NewCfg()
	if err := cfg.Load(args); err != nil {
		return nil, err
	}

	return cfg, nil
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

func (cfg *Cfg) Load(args CommandLineArgs) error {
	cfg.setHomePath(args)

	// Fix for missing IANA db on Windows
	_, zoneInfoSet := os.LookupEnv(zoneInfo)
	if runtime.GOOS == "windows" && !zoneInfoSet {
		if err := os.Setenv(zoneInfo, filepath.Join(HomePath, "tools", "zoneinfo.zip")); err != nil {
			cfg.Logger.Error("Can't set ZONEINFO environment variable", "err", err)
		}
	}

	iniFile, err := cfg.loadConfiguration(args)
	if err != nil {
		return err
	}

	cfg.Raw = iniFile

	// Temporarily keep global, to make refactor in steps
	Raw = cfg.Raw

	cfg.BuildVersion = BuildVersion
	cfg.BuildCommit = BuildCommit
	cfg.BuildStamp = BuildStamp
	cfg.BuildBranch = BuildBranch
	cfg.IsEnterprise = IsEnterprise
	cfg.Packaging = Packaging

	cfg.ErrTemplateName = "error"

	Target := valueAsString(iniFile.Section(""), "target", "all")
	cfg.Target = strings.Split(Target, " ")
	Env = valueAsString(iniFile.Section(""), "app_mode", "development")
	cfg.Env = Env
	cfg.ForceMigration = iniFile.Section("").Key("force_migration").MustBool(false)
	InstanceName = valueAsString(iniFile.Section(""), "instance_name", "unknown_instance_name")
	plugins := valueAsString(iniFile.Section("paths"), "plugins", "")
	cfg.PluginsPath = makeAbsolute(plugins, HomePath)
	cfg.BundledPluginsPath = makeAbsolute("plugins-bundled", HomePath)
	provisioning := valueAsString(iniFile.Section("paths"), "provisioning", "")
	cfg.ProvisioningPath = makeAbsolute(provisioning, HomePath)

	if err := cfg.readServerSettings(iniFile); err != nil {
		return err
	}

	if err := readDataProxySettings(iniFile, cfg); err != nil {
		return err
	}

	if err := readSecuritySettings(iniFile, cfg); err != nil {
		return err
	}

	if err := readSnapshotsSettings(cfg, iniFile); err != nil {
		return err
	}

	if err := readGRPCServerSettings(cfg, iniFile); err != nil {
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
	if err := readServiceAccountSettings(iniFile, cfg); err != nil {
		return err
	}
	if err := readAuthSettings(iniFile, cfg); err != nil {
		return err
	}

	readOAuth2ServerSettings(iniFile, cfg)

	readAccessControlSettings(iniFile, cfg)
	if err := cfg.readRenderingSettings(iniFile); err != nil {
		return err
	}

	cfg.TempDataLifetime = iniFile.Section("paths").Key("temp_data_lifetime").MustDuration(time.Second * 3600 * 24)
	cfg.MetricsEndpointEnabled = iniFile.Section("metrics").Key("enabled").MustBool(true)
	cfg.MetricsEndpointBasicAuthUsername = valueAsString(iniFile.Section("metrics"), "basic_auth_username", "")
	cfg.MetricsEndpointBasicAuthPassword = valueAsString(iniFile.Section("metrics"), "basic_auth_password", "")
	cfg.MetricsEndpointDisableTotalStats = iniFile.Section("metrics").Key("disable_total_stats").MustBool(false)

	analytics := iniFile.Section("analytics")
	cfg.CheckForGrafanaUpdates = analytics.Key("check_for_updates").MustBool(true)
	cfg.CheckForPluginUpdates = analytics.Key("check_for_plugin_updates").MustBool(true)

	cfg.GoogleAnalyticsID = analytics.Key("google_analytics_ua_id").String()
	cfg.GoogleAnalytics4ID = analytics.Key("google_analytics_4_id").String()
	cfg.GoogleAnalytics4SendManualPageViews = analytics.Key("google_analytics_4_send_manual_page_views").MustBool(false)
	cfg.GoogleTagManagerID = analytics.Key("google_tag_manager_id").String()
	cfg.RudderstackWriteKey = analytics.Key("rudderstack_write_key").String()
	cfg.RudderstackDataPlaneURL = analytics.Key("rudderstack_data_plane_url").String()
	cfg.RudderstackSDKURL = analytics.Key("rudderstack_sdk_url").String()
	cfg.RudderstackConfigURL = analytics.Key("rudderstack_config_url").String()
	cfg.IntercomSecret = analytics.Key("intercom_secret").String()

	cfg.ReportingEnabled = analytics.Key("reporting_enabled").MustBool(true)
	cfg.ReportingDistributor = analytics.Key("reporting_distributor").MustString("grafana-labs")

	if len(cfg.ReportingDistributor) >= 100 {
		cfg.ReportingDistributor = cfg.ReportingDistributor[:100]
	}

	cfg.ApplicationInsightsConnectionString = analytics.Key("application_insights_connection_string").String()
	cfg.ApplicationInsightsEndpointUrl = analytics.Key("application_insights_endpoint_url").String()
	cfg.FeedbackLinksEnabled = analytics.Key("feedback_links_enabled").MustBool(true)

	if err := readAlertingSettings(iniFile); err != nil {
		return err
	}

	explore := iniFile.Section("explore")
	ExploreEnabled = explore.Key("enabled").MustBool(true)

	help := iniFile.Section("help")
	HelpEnabled = help.Key("enabled").MustBool(true)

	profile := iniFile.Section("profile")
	ProfileEnabled = profile.Key("enabled").MustBool(true)

	queryHistory := iniFile.Section("query_history")
	cfg.QueryHistoryEnabled = queryHistory.Key("enabled").MustBool(true)

	panelsSection := iniFile.Section("panels")
	cfg.DisableSanitizeHtml = panelsSection.Key("disable_sanitize_html").MustBool(false)

	if err := cfg.readPluginSettings(iniFile); err != nil {
		return err
	}

	if err := cfg.readFeatureToggles(iniFile); err != nil {
		return err
	}

	if err := cfg.ReadUnifiedAlertingSettings(iniFile); err != nil {
		return err
	}

	// check old location for this option
	if panelsSection.Key("enable_alpha").MustBool(false) {
		cfg.PluginsEnableAlpha = true
	}

	cfg.readSAMLConfig()
	cfg.readLDAPConfig()
	cfg.handleAWSConfig()
	cfg.readAzureSettings()
	cfg.readSessionConfig()
	cfg.readSmtpSettings()
	if err := cfg.readAnnotationSettings(); err != nil {
		return err
	}

	cfg.readQuotaSettings()

	cfg.readExpressionsSettings()
	if err := cfg.readGrafanaEnvironmentMetrics(); err != nil {
		return err
	}

	cfg.readDataSourcesSettings()

	cfg.DashboardPreviews = readDashboardPreviewsSettings(iniFile)
	cfg.Storage = readStorageSettings(iniFile)
	cfg.Search = readSearchSettings(iniFile)

	cfg.SecureSocksDSProxy, err = readSecureSocksDSProxySettings(iniFile)
	if err != nil {
		// if the proxy is misconfigured, disable it rather than crashing
		cfg.SecureSocksDSProxy.Enabled = false
		cfg.Logger.Error("secure_socks_datasource_proxy unable to start up", "err", err.Error())
	}

	if VerifyEmailEnabled && !cfg.Smtp.Enabled {
		cfg.Logger.Warn("require_email_validation is enabled but smtp is disabled")
	}

	// check old key name
	GrafanaComUrl = valueAsString(iniFile.Section("grafana_net"), "url", "")
	if GrafanaComUrl == "" {
		GrafanaComUrl = valueAsString(iniFile.Section("grafana_com"), "url", "https://grafana.com")
	}
	cfg.GrafanaComURL = GrafanaComUrl

	cfg.GrafanaComAPIURL = valueAsString(iniFile.Section("grafana_com"), "api_url", GrafanaComUrl+"/api")

	imageUploadingSection := iniFile.Section("external_image_storage")
	cfg.ImageUploadProvider = valueAsString(imageUploadingSection, "provider", "")
	ImageUploadProvider = cfg.ImageUploadProvider

	enterprise := iniFile.Section("enterprise")
	cfg.EnterpriseLicensePath = valueAsString(enterprise, "license_path", filepath.Join(cfg.DataPath, "license.jwt"))

	cacheServer := iniFile.Section("remote_cache")
	dbName := valueAsString(cacheServer, "type", "database")
	connStr := valueAsString(cacheServer, "connstr", "")
	prefix := valueAsString(cacheServer, "prefix", "")
	encryption := cacheServer.Key("encryption").MustBool(false)

	cfg.RemoteCacheOptions = &RemoteCacheOptions{
		Name:       dbName,
		ConnStr:    connStr,
		Prefix:     prefix,
		Encryption: encryption,
	}

	geomapSection := iniFile.Section("geomap")
	basemapJSON := valueAsString(geomapSection, "default_baselayer_config", "")
	if basemapJSON != "" {
		layer := make(map[string]interface{})
		err = json.Unmarshal([]byte(basemapJSON), &layer)
		if err != nil {
			cfg.Logger.Error("Error reading json from default_baselayer_config", "error", err)
		} else {
			cfg.GeomapDefaultBaseLayerConfig = layer
		}
	}
	cfg.GeomapEnableCustomBaseLayers = geomapSection.Key("enable_custom_baselayers").MustBool(true)

	cfg.readDateFormats()
	cfg.readSentryConfig()
	cfg.readGrafanaJavascriptAgentConfig()

	if err := cfg.readLiveSettings(iniFile); err != nil {
		return err
	}

	cfg.LogConfigSources()

	return nil
}

func valueAsString(section *ini.Section, keyName string, defaultValue string) string {
	return section.Key(keyName).MustString(defaultValue)
}

type RemoteCacheOptions struct {
	Name       string
	ConnStr    string
	Prefix     string
	Encryption bool
}

func (cfg *Cfg) readSAMLConfig() {
	samlSec := cfg.Raw.Section("auth.saml")
	cfg.SAMLAuthEnabled = samlSec.Key("enabled").MustBool(false)
	cfg.SAMLSkipOrgRoleSync = samlSec.Key("skip_org_role_sync").MustBool(false)
}

func (cfg *Cfg) readLDAPConfig() {
	ldapSec := cfg.Raw.Section("auth.ldap")
	cfg.LDAPConfigFilePath = ldapSec.Key("config_file").String()
	cfg.LDAPSyncCron = ldapSec.Key("sync_cron").String()
	cfg.LDAPAuthEnabled = ldapSec.Key("enabled").MustBool(false)
	cfg.LDAPSkipOrgRoleSync = ldapSec.Key("skip_org_role_sync").MustBool(false)
	cfg.LDAPActiveSyncEnabled = ldapSec.Key("active_sync_enabled").MustBool(false)
	cfg.LDAPAllowSignup = ldapSec.Key("allow_sign_up").MustBool(true)
}

func (cfg *Cfg) handleAWSConfig() {
	awsPluginSec := cfg.Raw.Section("aws")
	cfg.AWSAssumeRoleEnabled = awsPluginSec.Key("assume_role_enabled").MustBool(true)
	allowedAuthProviders := awsPluginSec.Key("allowed_auth_providers").MustString("default,keys,credentials")
	for _, authProvider := range strings.Split(allowedAuthProviders, ",") {
		authProvider = strings.TrimSpace(authProvider)
		if authProvider != "" {
			cfg.AWSAllowedAuthProviders = append(cfg.AWSAllowedAuthProviders, authProvider)
		}
	}
	cfg.AWSListMetricsPageLimit = awsPluginSec.Key("list_metrics_page_limit").MustInt(500)
	// Also set environment variables that can be used by core plugins
	err := os.Setenv(awsds.AssumeRoleEnabledEnvVarKeyName, strconv.FormatBool(cfg.AWSAssumeRoleEnabled))
	if err != nil {
		cfg.Logger.Error(fmt.Sprintf("could not set environment variable '%s'", awsds.AssumeRoleEnabledEnvVarKeyName), err)
	}

	err = os.Setenv(awsds.AllowedAuthProvidersEnvVarKeyName, allowedAuthProviders)
	if err != nil {
		cfg.Logger.Error(fmt.Sprintf("could not set environment variable '%s'", awsds.AllowedAuthProvidersEnvVarKeyName), err)
	}
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

	cfg.Logger.Info("Target", "target", cfg.Target)
	cfg.Logger.Info("Path Home", "path", HomePath)
	cfg.Logger.Info("Path Data", "path", cfg.DataPath)
	cfg.Logger.Info("Path Logs", "path", cfg.LogsPath)
	cfg.Logger.Info("Path Plugins", "path", cfg.PluginsPath)
	cfg.Logger.Info("Path Provisioning", "path", cfg.ProvisioningPath)
	cfg.Logger.Info("App mode " + cfg.Env)
}

type DynamicSection struct {
	section *ini.Section
	Logger  log.Logger
}

// Key dynamically overrides keys with environment variables.
// As a side effect, the value of the setting key will be updated if an environment variable is present.
func (s *DynamicSection) Key(k string) *ini.Key {
	envKey := EnvKey(s.section.Name(), k)
	envValue := os.Getenv(envKey)
	key := s.section.Key(k)

	if len(envValue) == 0 {
		return key
	}

	key.SetValue(envValue)
	s.Logger.Info("Config overridden from Environment variable", "var", fmt.Sprintf("%s=%s", envKey, RedactedValue(envKey, envValue)))

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
	cfg.SecretKey = SecretKey
	DisableGravatar = security.Key("disable_gravatar").MustBool(true)
	cfg.DisableBruteForceLoginProtection = security.Key("disable_brute_force_login_protection").MustBool(false)

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
	cfg.AllowEmbedding = security.Key("allow_embedding").MustBool(false)

	cfg.ContentTypeProtectionHeader = security.Key("x_content_type_options").MustBool(true)
	cfg.XSSProtectionHeader = security.Key("x_xss_protection").MustBool(true)
	cfg.StrictTransportSecurity = security.Key("strict_transport_security").MustBool(false)
	cfg.StrictTransportSecurityMaxAge = security.Key("strict_transport_security_max_age_seconds").MustInt(86400)
	cfg.StrictTransportSecurityPreload = security.Key("strict_transport_security_preload").MustBool(false)
	cfg.StrictTransportSecuritySubDomains = security.Key("strict_transport_security_subdomains").MustBool(false)
	cfg.AngularSupportEnabled = security.Key("angular_support_enabled").MustBool(true)
	cfg.CSPEnabled = security.Key("content_security_policy").MustBool(false)
	cfg.CSPTemplate = security.Key("content_security_policy_template").MustString("")
	cfg.CSPReportOnlyEnabled = security.Key("content_security_policy_report_only").MustBool(false)
	cfg.CSPReportOnlyTemplate = security.Key("content_security_policy_report_only_template").MustString("")

	if cfg.CSPEnabled && cfg.CSPTemplate == "" {
		return fmt.Errorf("enabling content_security_policy requires a content_security_policy_template configuration")
	}

	if cfg.CSPReportOnlyEnabled && cfg.CSPReportOnlyTemplate == "" {
		return fmt.Errorf("enabling content_security_policy_report_only requires a content_security_policy_report_only_template configuration")
	}

	// read data source proxy whitelist
	DataProxyWhiteList = make(map[string]bool)
	securityStr := valueAsString(security, "data_source_proxy_whitelist", "")

	for _, hostAndIP := range util.SplitString(securityStr) {
		DataProxyWhiteList[hostAndIP] = true
	}

	// admin
	cfg.DisableInitAdminCreation = security.Key("disable_initial_admin_creation").MustBool(false)
	cfg.AdminUser = valueAsString(security, "admin_user", "")
	cfg.AdminPassword = valueAsString(security, "admin_password", "")
	cfg.AdminEmail = valueAsString(security, "admin_email", fmt.Sprintf("%s@localhost", cfg.AdminUser))

	return nil
}
func readAuthAzureADSettings(iniFile *ini.File, cfg *Cfg) {
	sec := iniFile.Section("auth.azuread")
	cfg.AzureADEnabled = sec.Key("enabled").MustBool(false)
	cfg.AzureADSkipOrgRoleSync = sec.Key("skip_org_role_sync").MustBool(false)
}

func readAuthGrafanaComSettings(iniFile *ini.File, cfg *Cfg) {
	sec := iniFile.Section("auth.grafana_com")
	cfg.GrafanaComAuthEnabled = sec.Key("enabled").MustBool(false)
	cfg.GrafanaComSkipOrgRoleSync = sec.Key("skip_org_role_sync").MustBool(false)
}

func readAuthGithubSettings(iniFile *ini.File, cfg *Cfg) {
	sec := iniFile.Section("auth.github")
	cfg.GitHubAuthEnabled = sec.Key("enabled").MustBool(false)
	cfg.GitHubSkipOrgRoleSync = sec.Key("skip_org_role_sync").MustBool(false)
}

func readAuthGoogleSettings(iniFile *ini.File, cfg *Cfg) {
	sec := iniFile.Section("auth.google")
	cfg.GoogleAuthEnabled = sec.Key("enabled").MustBool(false)
	cfg.GoogleSkipOrgRoleSync = sec.Key("skip_org_role_sync").MustBool(false)
}

func readAuthGitlabSettings(iniFile *ini.File, cfg *Cfg) {
	sec := iniFile.Section("auth.gitlab")
	cfg.GitLabAuthEnabled = sec.Key("enabled").MustBool(false)
	cfg.GitLabSkipOrgRoleSync = sec.Key("skip_org_role_sync").MustBool(false)
}

func readGenericOAuthSettings(iniFile *ini.File, cfg *Cfg) {
	sec := iniFile.Section("auth.generic_oauth")
	cfg.GenericOAuthAuthEnabled = sec.Key("enabled").MustBool(false)
	cfg.GenericOAuthSkipOrgRoleSync = sec.Key("skip_org_role_sync").MustBool(false)
}

func readAuthOktaSettings(iniFile *ini.File, cfg *Cfg) {
	sec := iniFile.Section("auth.okta")
	cfg.OktaAuthEnabled = sec.Key("enabled").MustBool(false)
	cfg.OktaSkipOrgRoleSync = sec.Key("skip_org_role_sync").MustBool(false)
}

func readAuthSettings(iniFile *ini.File, cfg *Cfg) (err error) {
	auth := iniFile.Section("auth")

	cfg.LoginCookieName = valueAsString(auth, "login_cookie_name", "grafana_session")

	const defaultMaxInactiveLifetime = "7d"
	maxInactiveDurationVal := valueAsString(auth, "login_maximum_inactive_lifetime_duration", defaultMaxInactiveLifetime)
	cfg.LoginMaxInactiveLifetime, err = gtime.ParseDuration(maxInactiveDurationVal)
	if err != nil {
		return err
	}

	const defaultMaxLifetime = "30d"
	maxLifetimeDurationVal := valueAsString(auth, "login_maximum_lifetime_duration", defaultMaxLifetime)
	cfg.LoginMaxLifetime, err = gtime.ParseDuration(maxLifetimeDurationVal)
	if err != nil {
		return err
	}

	cfg.ApiKeyMaxSecondsToLive = auth.Key("api_key_max_seconds_to_live").MustInt64(-1)

	cfg.TokenRotationIntervalMinutes = auth.Key("token_rotation_interval_minutes").MustInt(10)
	if cfg.TokenRotationIntervalMinutes < 2 {
		cfg.TokenRotationIntervalMinutes = 2
	}

	// Debug setting unlocking frontend auth sync lock. Users will still be reset on their next login.
	cfg.DisableSyncLock = auth.Key("disable_sync_lock").MustBool(false)

	cfg.DisableLoginForm = auth.Key("disable_login_form").MustBool(false)
	DisableSignoutMenu = auth.Key("disable_signout_menu").MustBool(false)

	// Deprecated
	cfg.OAuthAutoLogin = auth.Key("oauth_auto_login").MustBool(false)
	if cfg.OAuthAutoLogin {
		cfg.Logger.Warn("[Deprecated] The oauth_auto_login configuration setting is deprecated. Please use auto_login inside auth provider section instead.")
	}

	cfg.OAuthCookieMaxAge = auth.Key("oauth_state_cookie_max_age").MustInt(600)
	SignoutRedirectUrl = valueAsString(auth, "signout_redirect_url", "")
	// Deprecated
	cfg.OAuthSkipOrgRoleUpdateSync = auth.Key("oauth_skip_org_role_update_sync").MustBool(false)
	if cfg.OAuthSkipOrgRoleUpdateSync {
		cfg.Logger.Warn("[Deprecated] The oauth_skip_org_role_update_sync configuration setting is deprecated. Please use skip_org_role_sync inside the auth provider section instead.")
	}

	cfg.DisableLogin = auth.Key("disable_login").MustBool(false)

	// SigV4
	SigV4AuthEnabled = auth.Key("sigv4_auth_enabled").MustBool(false)
	cfg.SigV4AuthEnabled = SigV4AuthEnabled
	cfg.SigV4VerboseLogging = auth.Key("sigv4_verbose_logging").MustBool(false)

	// Azure Auth
	AzureAuthEnabled = auth.Key("azure_auth_enabled").MustBool(false)
	cfg.AzureAuthEnabled = AzureAuthEnabled
	readAuthAzureADSettings(iniFile, cfg)

	// Google Auth
	readAuthGoogleSettings(iniFile, cfg)

	// GitLab Auth
	readAuthGitlabSettings(iniFile, cfg)

	// Generic OAuth
	readGenericOAuthSettings(iniFile, cfg)

	// Okta Auth
	readAuthOktaSettings(iniFile, cfg)

	// anonymous access
	cfg.AnonymousEnabled = iniFile.Section("auth.anonymous").Key("enabled").MustBool(false)
	cfg.AnonymousOrgName = valueAsString(iniFile.Section("auth.anonymous"), "org_name", "")
	cfg.AnonymousOrgRole = valueAsString(iniFile.Section("auth.anonymous"), "org_role", "")
	cfg.AnonymousHideVersion = iniFile.Section("auth.anonymous").Key("hide_version").MustBool(false)

	// basic auth
	authBasic := iniFile.Section("auth.basic")
	cfg.BasicAuthEnabled = authBasic.Key("enabled").MustBool(true)

	// JWT auth
	authJWT := iniFile.Section("auth.jwt")
	cfg.JWTAuthEnabled = authJWT.Key("enabled").MustBool(false)
	cfg.JWTAuthHeaderName = valueAsString(authJWT, "header_name", "")
	cfg.JWTAuthURLLogin = authJWT.Key("url_login").MustBool(false)
	cfg.JWTAuthEmailClaim = valueAsString(authJWT, "email_claim", "")
	cfg.JWTAuthUsernameClaim = valueAsString(authJWT, "username_claim", "")
	cfg.JWTAuthExpectClaims = valueAsString(authJWT, "expect_claims", "{}")
	cfg.JWTAuthJWKSetURL = valueAsString(authJWT, "jwk_set_url", "")
	cfg.JWTAuthCacheTTL = authJWT.Key("cache_ttl").MustDuration(time.Minute * 60)
	cfg.JWTAuthKeyFile = valueAsString(authJWT, "key_file", "")
	cfg.JWTAuthJWKSetFile = valueAsString(authJWT, "jwk_set_file", "")
	cfg.JWTAuthAutoSignUp = authJWT.Key("auto_sign_up").MustBool(false)
	cfg.JWTAuthRoleAttributePath = valueAsString(authJWT, "role_attribute_path", "")
	cfg.JWTAuthRoleAttributeStrict = authJWT.Key("role_attribute_strict").MustBool(false)
	cfg.JWTAuthAllowAssignGrafanaAdmin = authJWT.Key("allow_assign_grafana_admin").MustBool(false)
	cfg.JWTAuthSkipOrgRoleSync = authJWT.Key("skip_org_role_sync").MustBool(false)

	authProxy := iniFile.Section("auth.proxy")
	cfg.AuthProxyEnabled = authProxy.Key("enabled").MustBool(false)

	cfg.AuthProxyHeaderName = valueAsString(authProxy, "header_name", "")
	cfg.AuthProxyHeaderProperty = valueAsString(authProxy, "header_property", "")
	cfg.AuthProxyAutoSignUp = authProxy.Key("auto_sign_up").MustBool(true)
	cfg.AuthProxyEnableLoginToken = authProxy.Key("enable_login_token").MustBool(false)

	cfg.AuthProxySyncTTL = authProxy.Key("sync_ttl").MustInt()

	cfg.AuthProxyWhitelist = valueAsString(authProxy, "whitelist", "")

	cfg.AuthProxyHeaders = make(map[string]string)
	headers := valueAsString(authProxy, "headers", "")

	for _, propertyAndHeader := range util.SplitString(headers) {
		split := strings.SplitN(propertyAndHeader, ":", 2)
		if len(split) == 2 {
			cfg.AuthProxyHeaders[split[0]] = split[1]
		}
	}

	cfg.AuthProxyHeadersEncoded = authProxy.Key("headers_encoded").MustBool(false)

	// GrafanaCom
	readAuthGrafanaComSettings(iniFile, cfg)

	// Github
	readAuthGithubSettings(iniFile, cfg)
	return nil
}

func readAccessControlSettings(iniFile *ini.File, cfg *Cfg) {
	rbac := iniFile.Section("rbac")
	cfg.RBACEnabled = rbac.Key("enabled").MustBool(true)
	cfg.RBACPermissionCache = rbac.Key("permission_cache").MustBool(true)
	cfg.RBACPermissionValidationEnabled = rbac.Key("permission_validation_enabled").MustBool(false)
	cfg.RBACResetBasicRoles = rbac.Key("reset_basic_roles").MustBool(false)
}

func readOAuth2ServerSettings(iniFile *ini.File, cfg *Cfg) {
	oauth2Srv := iniFile.Section("oauth2_server")
	cfg.OAuth2ServerEnabled = oauth2Srv.Key("enabled").MustBool(false)
	cfg.OAuth2ServerGeneratedKeyTypeForClient = strings.ToUpper(oauth2Srv.Key("generated_key_type_for_client").In("RSA", []string{"RSA", "ECDSA"}))
	cfg.OAuth2ServerAccessTokenLifespan = oauth2Srv.Key("access_token_lifespan").MustDuration(time.Minute * 3)
}

func readUserSettings(iniFile *ini.File, cfg *Cfg) error {
	users := iniFile.Section("users")
	AllowUserSignUp = users.Key("allow_sign_up").MustBool(true)
	AllowUserOrgCreate = users.Key("allow_org_create").MustBool(true)
	cfg.AutoAssignOrg = users.Key("auto_assign_org").MustBool(true)
	cfg.AutoAssignOrgId = users.Key("auto_assign_org_id").MustInt(1)
	cfg.AutoAssignOrgRole = users.Key("auto_assign_org_role").In("Editor", []string{"Editor", "Admin", "Viewer"})
	VerifyEmailEnabled = users.Key("verify_email_enabled").MustBool(false)

	cfg.CaseInsensitiveLogin = users.Key("case_insensitive_login").MustBool(false)

	LoginHint = valueAsString(users, "login_hint", "")
	PasswordHint = valueAsString(users, "password_hint", "")
	cfg.DefaultTheme = valueAsString(users, "default_theme", "")
	cfg.DefaultLanguage = valueAsString(users, "default_language", "")
	cfg.HomePage = valueAsString(users, "home_page", "")
	ExternalUserMngLinkUrl = valueAsString(users, "external_manage_link_url", "")
	ExternalUserMngLinkName = valueAsString(users, "external_manage_link_name", "")
	ExternalUserMngInfo = valueAsString(users, "external_manage_info", "")

	cfg.ViewersCanEdit = users.Key("viewers_can_edit").MustBool(false)
	cfg.EditorsCanAdmin = users.Key("editors_can_admin").MustBool(false)

	userInviteMaxLifetimeVal := valueAsString(users, "user_invite_max_lifetime_duration", "24h")
	userInviteMaxLifetimeDuration, err := gtime.ParseDuration(userInviteMaxLifetimeVal)
	if err != nil {
		return err
	}

	cfg.UserInviteMaxLifetime = userInviteMaxLifetimeDuration
	if cfg.UserInviteMaxLifetime < time.Minute*15 {
		return errors.New("the minimum supported value for the `user_invite_max_lifetime_duration` configuration is 15m (15 minutes)")
	}

	cfg.HiddenUsers = make(map[string]struct{})
	hiddenUsers := users.Key("hidden_users").MustString("")
	for _, user := range strings.Split(hiddenUsers, ",") {
		user = strings.TrimSpace(user)
		if user != "" {
			cfg.HiddenUsers[user] = struct{}{}
		}
	}

	return nil
}

func readServiceAccountSettings(iniFile *ini.File, cfg *Cfg) error {
	serviceAccount := iniFile.Section("service_accounts")
	cfg.SATokenExpirationDayLimit = serviceAccount.Key("token_expiration_day_limit").MustInt(-1)
	return nil
}

func (cfg *Cfg) readRenderingSettings(iniFile *ini.File) error {
	renderSec := iniFile.Section("rendering")
	cfg.RendererUrl = valueAsString(renderSec, "server_url", "")
	cfg.RendererCallbackUrl = valueAsString(renderSec, "callback_url", "")
	cfg.RendererAuthToken = valueAsString(renderSec, "renderer_token", "-")

	if cfg.RendererCallbackUrl == "" {
		cfg.RendererCallbackUrl = AppUrl
	} else {
		if cfg.RendererCallbackUrl[len(cfg.RendererCallbackUrl)-1] != '/' {
			cfg.RendererCallbackUrl += "/"
		}
		_, err := url.Parse(cfg.RendererCallbackUrl)
		if err != nil {
			// XXX: Should return an error?
			cfg.Logger.Error("Invalid callback_url.", "url", cfg.RendererCallbackUrl, "error", err)
			os.Exit(1)
		}
	}

	cfg.RendererConcurrentRequestLimit = renderSec.Key("concurrent_render_request_limit").MustInt(30)
	cfg.RendererRenderKeyLifeTime = renderSec.Key("render_key_lifetime").MustDuration(5 * time.Minute)
	cfg.ImagesDir = filepath.Join(cfg.DataPath, "png")
	cfg.CSVsDir = filepath.Join(cfg.DataPath, "csv")

	return nil
}

func readAlertingSettings(iniFile *ini.File) error {
	alerting := iniFile.Section("alerting")
	enabled, err := alerting.Key("enabled").Bool()
	AlertingEnabled = nil
	if err == nil {
		AlertingEnabled = &enabled
	}
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

func readGRPCServerSettings(cfg *Cfg, iniFile *ini.File) error {
	server := iniFile.Section("grpc_server")
	errPrefix := "grpc_server:"
	useTLS := server.Key("use_tls").MustBool(false)
	certFile := server.Key("cert_file").String()
	keyFile := server.Key("cert_key").String()
	if useTLS {
		serverCert, err := tls.LoadX509KeyPair(certFile, keyFile)
		if err != nil {
			return fmt.Errorf("%s error loading X509 key pair: %w", errPrefix, err)
		}
		cfg.GRPCServerTLSConfig = &tls.Config{
			Certificates: []tls.Certificate{serverCert},
			ClientAuth:   tls.NoClientCert,
		}
	}

	cfg.GRPCServerNetwork = valueAsString(server, "network", "tcp")
	cfg.GRPCServerAddress = valueAsString(server, "address", "")
	switch cfg.GRPCServerNetwork {
	case "unix":
		if cfg.GRPCServerAddress != "" {
			// Explicitly provided path for unix domain socket.
			if stat, err := os.Stat(cfg.GRPCServerAddress); os.IsNotExist(err) {
				// File does not exist - nice, nothing to do.
			} else if err != nil {
				return fmt.Errorf("%s error getting stat for a file: %s", errPrefix, cfg.GRPCServerAddress)
			} else {
				if stat.Mode()&fs.ModeSocket == 0 {
					return fmt.Errorf("%s file %s already exists and is not a unix domain socket", errPrefix, cfg.GRPCServerAddress)
				}
				// Unix domain socket file, should be safe to remove.
				err := os.Remove(cfg.GRPCServerAddress)
				if err != nil {
					return fmt.Errorf("%s can't remove unix socket file: %s", errPrefix, cfg.GRPCServerAddress)
				}
			}
		} else {
			// Use temporary file path for a unix domain socket.
			tf, err := os.CreateTemp("", "gf_grpc_server_api")
			if err != nil {
				return fmt.Errorf("%s error creating tmp file: %v", errPrefix, err)
			}
			unixPath := tf.Name()
			if err := tf.Close(); err != nil {
				return fmt.Errorf("%s error closing tmp file: %v", errPrefix, err)
			}
			if err := os.Remove(unixPath); err != nil {
				return fmt.Errorf("%s error removing tmp file: %v", errPrefix, err)
			}
			cfg.GRPCServerAddress = unixPath
		}
	case "tcp":
		if cfg.GRPCServerAddress == "" {
			cfg.GRPCServerAddress = "127.0.0.1:10000"
		}
	default:
		return fmt.Errorf("%s unsupported network %s", errPrefix, cfg.GRPCServerNetwork)
	}
	return nil
}

// IsLegacyAlertingEnabled returns whether the legacy alerting is enabled or not.
// It's safe to be used only after readAlertingSettings() and ReadUnifiedAlertingSettings() are executed.
func IsLegacyAlertingEnabled() bool {
	return AlertingEnabled != nil && *AlertingEnabled
}

func readSnapshotsSettings(cfg *Cfg, iniFile *ini.File) error {
	snapshots := iniFile.Section("snapshots")

	cfg.SnapshotEnabled = snapshots.Key("enabled").MustBool(true)

	cfg.ExternalSnapshotUrl = valueAsString(snapshots, "external_snapshot_url", "")
	cfg.ExternalSnapshotName = valueAsString(snapshots, "external_snapshot_name", "")

	cfg.ExternalEnabled = snapshots.Key("external_enabled").MustBool(true)
	cfg.SnapShotRemoveExpired = snapshots.Key("snapshot_remove_expired").MustBool(true)
	cfg.SnapshotPublicMode = snapshots.Key("public_mode").MustBool(false)

	return nil
}

func (cfg *Cfg) readServerSettings(iniFile *ini.File) error {
	server := iniFile.Section("server")
	var err error
	AppUrl, AppSubUrl, err = cfg.parseAppUrlAndSubUrl(server)
	if err != nil {
		return err
	}
	ServeFromSubPath = server.Key("serve_from_sub_path").MustBool(false)

	cfg.AppURL = AppUrl
	cfg.AppSubURL = AppSubUrl
	cfg.ServeFromSubPath = ServeFromSubPath
	cfg.Protocol = HTTPScheme

	protocolStr := valueAsString(server, "protocol", "http")

	if protocolStr == "https" {
		cfg.Protocol = HTTPSScheme
		cfg.CertFile = server.Key("cert_file").String()
		cfg.KeyFile = server.Key("cert_key").String()
	}
	if protocolStr == "h2" {
		cfg.Protocol = HTTP2Scheme
		cfg.CertFile = server.Key("cert_file").String()
		cfg.KeyFile = server.Key("cert_key").String()
	}
	if protocolStr == "socket" {
		cfg.Protocol = SocketScheme
		cfg.SocketGid = server.Key("socket_gid").MustInt(-1)
		cfg.SocketMode = server.Key("socket_mode").MustInt(0660)
		cfg.SocketPath = server.Key("socket").String()
	}

	cfg.Domain = valueAsString(server, "domain", "localhost")
	cfg.HTTPAddr = valueAsString(server, "http_addr", DefaultHTTPAddr)
	cfg.HTTPPort = valueAsString(server, "http_port", "3000")
	cfg.RouterLogging = server.Key("router_logging").MustBool(false)

	cfg.EnableGzip = server.Key("enable_gzip").MustBool(false)
	cfg.EnforceDomain = server.Key("enforce_domain").MustBool(false)
	staticRoot := valueAsString(server, "static_root_path", "")
	StaticRootPath = makeAbsolute(staticRoot, HomePath)
	cfg.StaticRootPath = StaticRootPath

	if err := cfg.validateStaticRootPath(); err != nil {
		return err
	}

	cdnURL := valueAsString(server, "cdn_url", "")
	if cdnURL != "" {
		cfg.CDNRootURL, err = url.Parse(cdnURL)
		if err != nil {
			return err
		}
	}

	cfg.ReadTimeout = server.Key("read_timeout").MustDuration(0)

	headersSection := cfg.Raw.Section("server.custom_response_headers")
	keys := headersSection.Keys()
	cfg.CustomResponseHeaders = make(map[string]string, len(keys))

	for _, key := range keys {
		cfg.CustomResponseHeaders[key.Name()] = key.Value()
	}

	return nil
}

// GetContentDeliveryURL returns full content delivery URL with /<edition>/<version> added to URL
func (cfg *Cfg) GetContentDeliveryURL(prefix string) string {
	if cfg.CDNRootURL != nil {
		url := *cfg.CDNRootURL
		preReleaseFolder := ""

		url.Path = path.Join(url.Path, prefix, preReleaseFolder, cfg.BuildVersion)
		return url.String() + "/"
	}

	return ""
}

func (cfg *Cfg) readDataSourcesSettings() {
	datasources := cfg.Raw.Section("datasources")
	cfg.DataSourceLimit = datasources.Key("datasource_limit").MustInt(5000)
}

func GetAllowedOriginGlobs(originPatterns []string) ([]glob.Glob, error) {
	allowedOrigins := originPatterns
	originGlobs := make([]glob.Glob, 0, len(allowedOrigins))
	for _, originPattern := range allowedOrigins {
		g, err := glob.Compile(originPattern)
		if err != nil {
			return nil, fmt.Errorf("error parsing origin pattern: %v", err)
		}
		originGlobs = append(originGlobs, g)
	}
	return originGlobs, nil
}

func (cfg *Cfg) readLiveSettings(iniFile *ini.File) error {
	section := iniFile.Section("live")
	cfg.LiveMaxConnections = section.Key("max_connections").MustInt(100)
	if cfg.LiveMaxConnections < -1 {
		return fmt.Errorf("unexpected value %d for [live] max_connections", cfg.LiveMaxConnections)
	}
	cfg.LiveHAEngine = section.Key("ha_engine").MustString("")
	switch cfg.LiveHAEngine {
	case "", "redis":
	default:
		return fmt.Errorf("unsupported live HA engine type: %s", cfg.LiveHAEngine)
	}
	cfg.LiveHAEngineAddress = section.Key("ha_engine_address").MustString("127.0.0.1:6379")

	var originPatterns []string
	allowedOrigins := section.Key("allowed_origins").MustString("")
	for _, originPattern := range strings.Split(allowedOrigins, ",") {
		originPattern = strings.TrimSpace(originPattern)
		if originPattern == "" {
			continue
		}
		originPatterns = append(originPatterns, originPattern)
	}
	_, err := GetAllowedOriginGlobs(originPatterns)
	if err != nil {
		return err
	}
	cfg.LiveAllowedOrigins = originPatterns
	return nil
}

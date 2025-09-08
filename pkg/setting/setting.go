// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package setting

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gobwas/glob"
	"github.com/prometheus/common/model"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/osutil"
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
	ApplicationName  = "Grafana"
)

// zoneInfo names environment variable for setting the path to look for the timezone database in go
const zoneInfo = "ZONEINFO"

var (
	customInitPath = "conf/custom.ini"

	// App settings.
	Env       = Dev
	AppUrl    string
	AppSubUrl string

	// build
	BuildVersion          string
	BuildCommit           string
	EnterpriseBuildCommit string
	BuildBranch           string
	BuildStamp            int64
	IsEnterprise          bool

	// packaging
	Packaging = "unknown"

	CookieSecure           bool
	CookieSameSiteDisabled bool
	CookieSameSiteMode     http.SameSite
)

// TODO move all global vars to this struct
type Cfg struct {
	Target []string
	Raw    *ini.File
	Logger log.Logger

	// for logging purposes
	configFiles                  []string
	appliedCommandLineProperties []string
	appliedEnvOverrides          []string

	// HTTP Server Settings
	CertFile          string
	KeyFile           string
	CertPassword      string
	CertWatchInterval time.Duration
	HTTPAddr          string
	HTTPPort          string
	Env               string
	AppURL            string
	AppSubURL         string
	InstanceName      string
	ServeFromSubPath  bool
	StaticRootPath    string
	Protocol          Scheme
	SocketGid         int
	SocketMode        int
	SocketPath        string
	RouterLogging     bool
	Domain            string
	CDNRootURL        *url.URL
	ReadTimeout       time.Duration
	EnableGzip        bool
	EnforceDomain     bool
	MinTLSVersion     string

	// Security settings
	SecretKey             string
	EmailCodeValidMinutes int

	// build
	BuildVersion          string
	BuildCommit           string
	EnterpriseBuildCommit string
	BuildBranch           string
	BuildStamp            int64
	IsEnterprise          bool

	// packaging
	Packaging string

	// Paths
	HomePath                   string
	ProvisioningPath           string
	PermittedProvisioningPaths []string
	// Provisioning config
	ProvisioningDisableControllers bool
	ProvisioningLokiURL            string
	ProvisioningLokiUser           string
	ProvisioningLokiPassword       string
	ProvisioningLokiTenantID       string
	DataPath                       string
	LogsPath                       string
	PluginsPath                    string
	EnterpriseLicensePath          string

	// SMTP email settings
	Smtp SmtpSettings

	// Rendering
	ImagesDir                      string
	CSVsDir                        string
	PDFsDir                        string
	RendererServerUrl              string
	RendererCallbackUrl            string
	RendererAuthToken              string
	RendererConcurrentRequestLimit int
	RendererRenderKeyLifeTime      time.Duration
	RendererDefaultImageWidth      int
	RendererDefaultImageHeight     int
	RendererDefaultImageScale      float64

	// Security
	DisableInitAdminCreation             bool
	DisableBruteForceLoginProtection     bool
	BruteForceLoginProtectionMaxAttempts int64
	DisableUsernameLoginProtection       bool
	DisableIPAddressLoginProtection      bool
	CookieSecure                         bool
	CookieSameSiteDisabled               bool
	CookieSameSiteMode                   http.SameSite
	AllowEmbedding                       bool
	XSSProtectionHeader                  bool
	ContentTypeProtectionHeader          bool
	StrictTransportSecurity              bool
	StrictTransportSecurityMaxAge        int
	StrictTransportSecurityPreload       bool
	StrictTransportSecuritySubDomains    bool
	// CSPEnabled toggles Content Security Policy support.
	CSPEnabled bool
	// CSPTemplate contains the Content Security Policy template.
	CSPTemplate string
	// CSPReportEnabled toggles Content Security Policy Report Only support.
	CSPReportOnlyEnabled bool
	// CSPReportOnlyTemplate contains the Content Security Policy Report Only template.
	CSPReportOnlyTemplate           string
	EnableFrontendSandboxForPlugins []string
	DisableGravatar                 bool
	DataProxyWhiteList              map[string]bool
	ActionsAllowPostURL             string

	// K8s Dashboard Cleanup
	K8sDashboardCleanup K8sDashboardCleanupSettings

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
	PluginForcePublicKeyDownload     bool
	PluginSkipPublicKeyDownload      bool
	DisablePlugins                   []string
	ForwardHostEnvVars               []string
	PreinstallPluginsAsync           []InstallPlugin
	PreinstallPluginsSync            []InstallPlugin

	PluginsCDNURLTemplate    string
	PluginLogBackendRequests bool

	PluginUpdateStrategy string

	// Plugin API restrictions - maps API name to list of plugin IDs/patterns
	PluginRestrictedAPIsAllowList map[string][]string
	PluginRestrictedAPIsBlockList map[string][]string

	// Panels
	DisableSanitizeHtml bool

	// Metrics
	MetricsEndpointEnabled           bool
	MetricsEndpointBasicAuthUsername string
	MetricsEndpointBasicAuthPassword string
	MetricsEndpointDisableTotalStats bool
	// MetricsIncludeTeamLabel configures grafana to set a label for
	// the team responsible for the code at Grafana labs. We don't expect anyone else to
	// use this setting.
	MetricsIncludeTeamLabel          bool
	MetricsTotalStatsIntervalSeconds int
	MetricsGrafanaEnvironmentInfo    map[string]string

	// Dashboards
	DashboardVersionsToKeep     int
	MinRefreshInterval          string
	DefaultHomeDashboardPath    string
	DashboardPerformanceMetrics []string
	PanelSeriesLimit            int

	// Auth
	LoginCookieName               string
	LoginMaxInactiveLifetime      time.Duration
	LoginMaxLifetime              time.Duration
	TokenRotationIntervalMinutes  int
	SigV4AuthEnabled              bool
	SigV4VerboseLogging           bool
	AzureAuthEnabled              bool
	AzureSkipOrgRoleSync          bool
	BasicAuthEnabled              bool
	BasicAuthStrongPasswordPolicy bool
	AdminUser                     string
	AdminPassword                 string
	DisableLogin                  bool
	AdminEmail                    string
	DisableLoginForm              bool
	SignoutRedirectUrl            string
	IDResponseHeaderEnabled       bool
	IDResponseHeaderPrefix        string
	IDResponseHeaderNamespaces    map[string]struct{}
	ManagedServiceAccountsEnabled bool

	// AWS Plugin Auth
	AWSAllowedAuthProviders   []string
	AWSAssumeRoleEnabled      bool
	AWSSessionDuration        string
	AWSExternalId             string
	AWSListMetricsPageLimit   int
	AWSForwardSettingsPlugins []string

	// Azure Cloud settings
	Azure *azsettings.AzureSettings

	// Auth proxy settings
	AuthProxy AuthProxySettings

	// OAuth
	OAuthAutoLogin                       bool
	OAuthLoginErrorMessage               string
	OAuthCookieMaxAge                    int
	OAuthAllowInsecureEmailLookup        bool
	OAuthRefreshTokenServerLockMinWaitMs int64

	JWTAuth    AuthJWTSettings
	ExtJWTAuth ExtJWTSettings

	PasswordlessMagicLinkAuth AuthPasswordlessMagicLinkSettings

	// SSO Settings Auth
	SSOSettingsReloadInterval        time.Duration
	SSOSettingsConfigurableProviders map[string]bool

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
	RemoteCacheOptions *RemoteCacheSettings

	// Deprecated: no longer used
	ViewersCanEdit bool

	ApiKeyMaxSecondsToLive int64

	// Check if a feature toggle is enabled
	// Deprecated: use featuremgmt.FeatureFlags
	IsFeatureToggleEnabled func(key string) bool // filled in dynamically

	Anonymous AnonymousSettings

	DateFormats DateFormats
	QuickRanges QuickRanges

	// User
	UserInviteMaxLifetime        time.Duration
	HiddenUsers                  map[string]struct{}
	CaseInsensitiveLogin         bool // Login and Email will be considered case insensitive
	UserLastSeenUpdateInterval   time.Duration
	VerificationEmailMaxLifetime time.Duration

	// Service Accounts
	SATokenExpirationDayLimit int

	// Annotations
	AnnotationCleanupJobBatchSize      int64
	AnnotationMaximumTagsLength        int64
	AlertingAnnotationCleanupSetting   AnnotationCleanupSettings
	DashboardAnnotationCleanupSettings AnnotationCleanupSettings
	APIAnnotationCleanupSettings       AnnotationCleanupSettings

	// GrafanaJavascriptAgent config
	GrafanaJavascriptAgent GrafanaJavascriptAgent

	// Data sources
	DataSourceLimit int
	// Number of queries to be executed concurrently. Only for the datasource supports concurrency.
	ConcurrentQueryCount int
	// Default behavior for the "Manage alerts via Alerting UI" toggle when configuring a data source.
	// It only works if the data source's `jsonData.manageAlerts` prop does not contain a previously configured value.
	DefaultDatasourceManageAlertsUIToggle bool
	// Default behavior for the "Allow as recording rules target" toggle when configuring a data source.
	// It only works if the data source's `jsonData.allowAsRecordingRulesTarget` prop does not contain a previously configured value.
	DefaultAllowRecordingRulesTargetAlertsUIToggle bool

	// IP range access control
	IPRangeACEnabled     bool
	IPRangeACAllowedURLs []*url.URL
	IPRangeACSecretKey   string

	// SQL Data sources
	SqlDatasourceMaxOpenConnsDefault    int
	SqlDatasourceMaxIdleConnsDefault    int
	SqlDatasourceMaxConnLifetimeDefault int

	// Snapshots
	SnapshotEnabled      bool
	ExternalSnapshotUrl  string
	ExternalSnapshotName string
	ExternalEnabled      bool

	// Only used in https://snapshots.raintank.io/
	SnapshotPublicMode bool

	ErrTemplateName string

	StackID string
	Slug    string

	LocalFileSystemAvailable bool

	// Analytics
	CheckForGrafanaUpdates              bool
	CheckForPluginUpdates               bool
	ReportingDistributor                string
	ReportingEnabled                    bool
	ApplicationInsightsConnectionString string
	ApplicationInsightsEndpointUrl      string
	FeedbackLinksEnabled                bool
	ReportingStaticContext              map[string]string

	// Frontend analytics
	GoogleAnalyticsID                   string
	GoogleAnalytics4ID                  string
	GoogleAnalytics4SendManualPageViews bool
	GoogleTagManagerID                  string
	RudderstackDataPlaneURL             string
	RudderstackWriteKey                 string
	RudderstackSDKURL                   string
	RudderstackConfigURL                string
	RudderstackIntegrationsURL          string
	IntercomSecret                      string
	FrontendAnalyticsConsoleReporting   bool

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

	// User settings
	AllowUserSignUp                bool
	AllowUserOrgCreate             bool
	VerifyEmailEnabled             bool
	LoginHint                      string
	PasswordHint                   string
	DisableSignoutMenu             bool
	ExternalUserMngLinkUrl         string
	ExternalUserMngLinkName        string
	ExternalUserMngInfo            string
	ExternalUserMngAnalytics       bool
	ExternalUserMngAnalyticsParams string
	AutoAssignOrg                  bool
	AutoAssignOrgId                int
	AutoAssignOrgRole              string
	LoginDefaultOrgId              int64
	OAuthSkipOrgRoleUpdateSync     bool

	// ExpressionsEnabled specifies whether expressions are enabled.
	ExpressionsEnabled bool

	// SQLExpressionCellLimit is the maximum number of cells (rows × columns, across all frames) that can be accepted by a SQL expression.
	SQLExpressionCellLimit int64

	// SQLExpressionOutputCellLimit is the maximum number of cells (rows × columns) that can be outputted by a SQL expression.
	SQLExpressionOutputCellLimit int64

	// SQLExpressionQueryLengthLimit is the maximum length of a SQL query that can be used in a SQL expression.
	SQLExpressionQueryLengthLimit int64

	// SQLExpressionTimeoutSeconds is the duration a SQL expression will run before timing out
	SQLExpressionTimeout time.Duration

	ImageUploadProvider string

	// LiveMaxConnections is a maximum number of WebSocket connections to
	// Grafana Live ws endpoint (per Grafana server instance). 0 disables
	// Live, -1 means unlimited connections.
	LiveMaxConnections int
	// LiveHAEngine is a type of engine to use to achieve HA with Grafana Live.
	// Zero value means in-memory single node setup.
	LiveHAEngine string
	// LiveHAPRefix is a prefix for HA engine keys.
	LiveHAPrefix string
	// LiveHAEngineAddress is a connection address for Live HA engine.
	LiveHAEngineAddress  string
	LiveHAEnginePassword string
	// LiveAllowedOrigins is a set of origins accepted by Live. If not provided
	// then Live uses AppURL as the only allowed origin.
	LiveAllowedOrigins []string
	// LiveMessageSizeLimit is the maximum size in bytes of Websocket messages
	// from clients. Defaults to 64KB.
	LiveMessageSizeLimit int

	// Grafana.com URL, used for OAuth redirect.
	GrafanaComURL string
	// Grafana.com API URL. Can be set separately to GrafanaComURL
	// in case API is not publicly accessible.
	// Defaults to GrafanaComURL setting + "/api" if unset.
	GrafanaComAPIURL string

	// Grafana.com SSO API token used for Unified SSO between instances and Grafana.com.
	GrafanaComSSOAPIToken string

	// Geomap base layer config
	GeomapDefaultBaseLayerConfig map[string]any
	GeomapEnableCustomBaseLayers bool

	// Unified Alerting
	UnifiedAlerting UnifiedAlertingSettings

	// Query history
	QueryHistoryEnabled bool

	// Open feature settings
	OpenFeature OpenFeatureSettings

	Storage StorageSettings

	Search SearchSettings

	SecureSocksDSProxy SecureSocksDSProxySettings

	// SAML Auth
	SAMLAuthEnabled            bool
	SAMLSkipOrgRoleSync        bool
	SAMLRoleValuesGrafanaAdmin string

	// OAuth2 Server
	OAuth2ServerEnabled bool

	// OAuth2Server supports the two recommended key types from the RFC https://www.rfc-editor.org/rfc/rfc7518#section-3.1: RS256 and ES256
	OAuth2ServerGeneratedKeyTypeForClient string
	OAuth2ServerAccessTokenLifespan       time.Duration

	RBAC RBACSettings

	ZanzanaClient ZanzanaClientSettings
	ZanzanaServer ZanzanaServerSettings

	// GRPC Server.
	GRPCServer GRPCServerSettings

	CustomResponseHeaders map[string]string

	// This is used to override the general error message shown to users when we want to obfuscate a sensitive backend error
	UserFacingDefaultError string

	// DatabaseInstrumentQueries is used to decide if database queries
	// should be instrumented with metrics, logs and traces.
	// This needs to be on the global object since its used in the
	// sqlstore package and HTTP middlewares.
	DatabaseInstrumentQueries bool

	// Public dashboards
	PublicDashboardsEnabled bool

	// Cloud Migration
	CloudMigration CloudMigrationSettings

	// Feature Management Settings
	FeatureManagement FeatureMgmtSettings

	// Alerting
	AlertingEvaluationTimeout   time.Duration
	AlertingNotificationTimeout time.Duration
	AlertingMaxAttempts         int
	AlertingMinInterval         int64

	// Explore UI
	ExploreEnabled           bool
	ExploreDefaultTimeOffset string
	ExploreHideLogsDownload  bool

	// Help UI
	HelpEnabled bool

	// Profile UI
	ProfileEnabled bool

	// News Feed
	NewsFeedEnabled bool

	// Experimental scope settings
	ScopesListScopesURL     string
	ScopesListDashboardsURL string

	// Short Links
	ShortLinkExpiration int

	// Unified Storage
	UnifiedStorage                             map[string]UnifiedStorageConfig
	MaxPageSizeBytes                           int
	IndexPath                                  string
	IndexWorkers                               int
	IndexMaxBatchSize                          int
	IndexFileThreshold                         int
	IndexMinCount                              int
	IndexMaxCount                              int
	IndexRebuildInterval                       time.Duration
	IndexCacheTTL                              time.Duration
	EnableSharding                             bool
	QOSEnabled                                 bool
	QOSNumberWorker                            int
	QOSMaxSizePerTenant                        int
	MemberlistBindAddr                         string
	MemberlistAdvertiseAddr                    string
	MemberlistAdvertisePort                    int
	MemberlistJoinMember                       string
	MemberlistClusterLabel                     string
	MemberlistClusterLabelVerificationDisabled bool
	SearchRingReplicationFactor                int
	InstanceID                                 string
	SprinklesApiServer                         string
	SprinklesApiServerPageLimit                int
	CACertPath                                 string
	HttpsSkipVerify                            bool

	// Secrets Management
	SecretsManagement SecretsManagerSettings
}

type UnifiedStorageConfig struct {
	DualWriterMode                       rest.DualWriterMode
	DualWriterPeriodicDataSyncJobEnabled bool
	DualWriterMigrationDataSyncDisabled  bool
	// DataSyncerInterval defines how often the data syncer should run for a resource on the grafana instance.
	DataSyncerInterval time.Duration
	// DataSyncerRecordsLimit defines how many records will be processed at max during a sync invocation.
	DataSyncerRecordsLimit int
}

type InstallPlugin struct {
	ID      string `json:"id"`
	Version string `json:"version"`
	URL     string `json:"url,omitempty"`
}

// AddChangePasswordLink returns if login form is disabled or not since
// the same intention can be used to hide both features.
func (cfg *Cfg) AddChangePasswordLink() bool {
	return !cfg.DisableLoginForm && !cfg.DisableLogin
}

type CommandLineArgs struct {
	Config   string
	HomePath string
	Args     []string
}

func (cfg *Cfg) parseAppUrlAndSubUrl(section *ini.Section) (string, string, error) {
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
	if value == "" {
		return ""
	}

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
		"CLIENT_SECRET",
		"ENTERPRISE_LICENSE",
		"API_DB_PASS",
		"^TOKEN$",
		"ID_FORWARDING_TOKEN$",
		"AUTHENTICATION_TOKEN$",
		"AUTH_TOKEN$",
		"RENDERER_TOKEN$",
		"API_TOKEN$",
		"WEBHOOK_TOKEN$",
		"INSTALL_TOKEN$",
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

func (cfg *Cfg) applyEnvVariableOverrides(file *ini.File) error {
	cfg.appliedEnvOverrides = make([]string, 0)
	for _, section := range file.Sections() {
		for _, key := range section.Keys() {
			envKey := EnvKey(section.Name(), key.Name())
			envValue := os.Getenv(envKey)

			if len(envValue) > 0 {
				key.SetValue(envValue)
				cfg.appliedEnvOverrides = append(cfg.appliedEnvOverrides, fmt.Sprintf("%s=%s", envKey, RedactedValue(envKey, envValue)))
			}
		}
	}

	return nil
}

func (cfg *Cfg) readGrafanaEnvironmentMetrics() error {
	environmentMetricsSection := cfg.Raw.Section("metrics.environment_info")
	keys := environmentMetricsSection.Keys()
	cfg.MetricsGrafanaEnvironmentInfo = make(map[string]string, len(keys))

	cfg.MetricsGrafanaEnvironmentInfo["version"] = cfg.BuildVersion
	cfg.MetricsGrafanaEnvironmentInfo["commit"] = cfg.BuildCommit

	if cfg.EnterpriseBuildCommit != "NA" && cfg.EnterpriseBuildCommit != "" {
		cfg.MetricsGrafanaEnvironmentInfo["enterprise_commit"] = cfg.EnterpriseBuildCommit
	}

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

	newAnnotationCleanupSettings := func(section *ini.Section, maxAgeField string) AnnotationCleanupSettings {
		maxAge, err := gtime.ParseDuration(section.Key(maxAgeField).MustString(""))
		if err != nil {
			maxAge = 0
		}

		return AnnotationCleanupSettings{
			MaxAge:   maxAge,
			MaxCount: section.Key("max_annotations_to_keep").MustInt64(0),
		}
	}

	alertingAnnotations := cfg.Raw.Section("unified_alerting.state_history.annotations")
	if alertingAnnotations.Key("max_age").Value() == "" && section.Key("max_annotations_to_keep").Value() == "" {
		// Although this section is not documented anymore, we decided to keep it to avoid potential data-loss when user upgrades Grafana and does not change the setting.
		// TODO delete some time after Grafana 11.
		alertingSection := cfg.Raw.Section("alerting")
		cleanup := newAnnotationCleanupSettings(alertingSection, "max_annotation_age")
		if cleanup.MaxCount > 0 || cleanup.MaxAge > 0 {
			cfg.Logger.Warn("settings 'max_annotations_to_keep' and 'max_annotation_age' in section [alerting] are deprecated. Please use settings 'max_annotations_to_keep' and 'max_age' in section [unified_alerting.state_history.annotations]")
		}
		cfg.AlertingAnnotationCleanupSetting = cleanup
	} else {
		cfg.AlertingAnnotationCleanupSetting = newAnnotationCleanupSettings(alertingAnnotations, "max_age")
	}

	cfg.DashboardAnnotationCleanupSettings = newAnnotationCleanupSettings(dashboardAnnotation, "max_age")
	cfg.APIAnnotationCleanupSettings = newAnnotationCleanupSettings(apiIAnnotation, "max_age")

	return nil
}

func (cfg *Cfg) readExpressionsSettings() {
	expressions := cfg.Raw.Section("expressions")
	cfg.ExpressionsEnabled = expressions.Key("enabled").MustBool(true)
	cfg.SQLExpressionCellLimit = expressions.Key("sql_expression_cell_limit").MustInt64(100000)
	cfg.SQLExpressionOutputCellLimit = expressions.Key("sql_expression_output_cell_limit").MustInt64(100000)
	cfg.SQLExpressionTimeout = expressions.Key("sql_expression_timeout").MustDuration(time.Second * 10)
	cfg.SQLExpressionQueryLengthLimit = expressions.Key("sql_expression_query_length_limit").MustInt64(10000)
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

func (cfg *Cfg) applyCommandLineDefaultProperties(props map[string]string, file *ini.File) {
	cfg.appliedCommandLineProperties = make([]string, 0)
	for _, section := range file.Sections() {
		for _, key := range section.Keys() {
			keyString := fmt.Sprintf("default.%s.%s", section.Name(), key.Name())
			value, exists := props[keyString]
			if exists {
				key.SetValue(value)
				cfg.appliedCommandLineProperties = append(cfg.appliedCommandLineProperties,
					fmt.Sprintf("%s=%s", keyString, RedactedValue(keyString, value)))
			}
		}
	}
}

func (cfg *Cfg) applyCommandLineProperties(props map[string]string, file *ini.File) {
	for _, section := range file.Sections() {
		sectionName := section.Name() + "."
		if section.Name() == ini.DefaultSection {
			sectionName = ""
		}
		for _, key := range section.Keys() {
			keyString := sectionName + key.Name()
			value, exists := props[keyString]
			if exists {
				cfg.appliedCommandLineProperties = append(cfg.appliedCommandLineProperties, fmt.Sprintf("%s=%s", keyString, value))
				key.SetValue(value)
			}
		}
	}
}

func (cfg *Cfg) getCommandLineProperties(args []string) map[string]string {
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
		configFile = filepath.Join(cfg.HomePath, customInitPath)
		// return without error if custom file does not exist
		if !pathExists(configFile) {
			return nil
		}
	}

	userConfig, err := ini.Load(configFile)
	if err != nil {
		return fmt.Errorf("failed to parse %q: %w", configFile, err)
	}

	// micro-optimization since we don't need to share this ini file. In
	// general, prefer to leave this flag as true as it is by default to prevent
	// data races
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

	cfg.configFiles = append(cfg.configFiles, configFile)
	return nil
}

func (cfg *Cfg) loadConfiguration(args CommandLineArgs) (*ini.File, error) {
	// load config defaults
	defaultConfigFile := path.Join(cfg.HomePath, "conf/defaults.ini")
	cfg.configFiles = append(cfg.configFiles, defaultConfigFile)

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

	// command line props
	commandLineProps := cfg.getCommandLineProperties(args.Args)
	// load default overrides
	cfg.applyCommandLineDefaultProperties(commandLineProps, parsedFile)

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
	err = cfg.applyEnvVariableOverrides(parsedFile)
	if err != nil {
		return nil, err
	}

	// apply command line overrides
	cfg.applyCommandLineProperties(commandLineProps, parsedFile)

	// evaluate config values containing environment variables
	err = expandConfig(parsedFile)
	if err != nil {
		return nil, err
	}

	// update data path and logging config
	dataPath := valueAsString(parsedFile.Section("paths"), "data", "")

	cfg.DataPath = makeAbsolute(dataPath, cfg.HomePath)
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
		return
	}

	var err error
	cfg.HomePath, err = filepath.Abs(".")
	if err != nil {
		panic(err)
	}

	// check if homepath is correct
	if pathExists(filepath.Join(cfg.HomePath, "conf/defaults.ini")) {
		return
	}

	// try down one path
	if pathExists(filepath.Join(cfg.HomePath, "../conf/defaults.ini")) {
		cfg.HomePath = filepath.Join(cfg.HomePath, "../")
	}
}

var skipStaticRootValidation = false

func NewCfg() *Cfg {
	return &Cfg{
		Env:    Dev,
		Target: []string{"all"},
		Logger: log.New("settings"),
		Raw:    ini.Empty(),
		Azure:  &azsettings.AzureSettings{},

		// Initialize plugin API restriction maps
		PluginRestrictedAPIsAllowList: make(map[string][]string),
		PluginRestrictedAPIsBlockList: make(map[string][]string),

		// Avoid nil pointer
		IsFeatureToggleEnabled: func(_ string) bool {
			return false
		},
	}
}

// Deprecated: Avoid using IsFeatureToggleEnabled from settings.  If you need to access
// feature flags, read them from the FeatureToggle (or FeatureManager) interface
func NewCfgWithFeatures(features func(string) bool) *Cfg {
	cfg := NewCfg()
	cfg.IsFeatureToggleEnabled = features
	return cfg
}

func NewCfgFromArgs(args CommandLineArgs) (*Cfg, error) {
	cfg := NewCfg()
	if err := cfg.Load(args); err != nil {
		return nil, err
	}

	return cfg, nil
}

// NewCfgFromBytes specialized function to create a new Cfg from bytes (INI file).
func NewCfgFromBytes(bytes []byte) (*Cfg, error) {
	parsedFile, err := ini.Load(bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse bytes as INI file: %w", err)
	}

	return NewCfgFromINIFile(parsedFile)
}

// prevents a log line from being printed when the static root path is not found, useful for apiservers that have no frontend
func NewCfgFromBytesWithoutJSValidation(bytes []byte) (*Cfg, error) {
	skipStaticRootValidation = true
	return NewCfgFromBytes(bytes)
}

// NewCfgFromINIFile specialized function to create a new Cfg from an ini.File.
func NewCfgFromINIFile(iniFile *ini.File) (*Cfg, error) {
	cfg := NewCfg()

	if err := cfg.parseINIFile(iniFile); err != nil {
		return nil, fmt.Errorf("failed to parse setting from INI file: %w", err)
	}

	return cfg, nil
}

func (cfg *Cfg) validateStaticRootPath() error {
	if skipStaticRootValidation {
		return nil
	}

	if _, err := os.Stat(path.Join(cfg.StaticRootPath, "build")); err != nil {
		cfg.Logger.Error("Failed to detect generated javascript files in public/build")
	}

	return nil
}

func (cfg *Cfg) Load(args CommandLineArgs) error {
	cfg.setHomePath(args)

	// Fix for missing IANA db on Windows or Alpine
	_, zoneInfoSet := os.LookupEnv(zoneInfo)
	if !zoneInfoSet {
		if err := os.Setenv(zoneInfo, filepath.Join(cfg.HomePath, "tools", "zoneinfo.zip")); err != nil {
			cfg.Logger.Error("Can't set ZONEINFO environment variable", "err", err)
		}
	}

	iniFile, err := cfg.loadConfiguration(args)
	if err != nil {
		return err
	}

	err = cfg.parseINIFile(iniFile)
	if err != nil {
		return err
	}

	cfg.LogConfigSources()

	return nil
}

// nolint:gocyclo
func (cfg *Cfg) parseINIFile(iniFile *ini.File) error {
	cfg.Raw = iniFile

	cfg.BuildVersion = BuildVersion
	cfg.BuildCommit = BuildCommit
	cfg.EnterpriseBuildCommit = EnterpriseBuildCommit
	cfg.BuildStamp = BuildStamp
	cfg.BuildBranch = BuildBranch
	cfg.IsEnterprise = IsEnterprise
	cfg.Packaging = Packaging

	cfg.ErrTemplateName = "error"

	Target := valueAsString(iniFile.Section(""), "target", "all")
	if Target != "" {
		cfg.Target = util.SplitString(Target)
	}
	cfg.Env = valueAsString(iniFile.Section(""), "app_mode", "development")
	cfg.StackID = valueAsString(iniFile.Section("environment"), "stack_id", "")
	cfg.Slug = valueAsString(iniFile.Section("environment"), "stack_slug", "")
	cfg.LocalFileSystemAvailable = iniFile.Section("environment").Key("local_file_system_available").MustBool(true)
	cfg.InstanceName = valueAsString(iniFile.Section(""), "instance_name", "unknown_instance_name")
	plugins := valueAsString(iniFile.Section("paths"), "plugins", "")
	cfg.PluginsPath = makeAbsolute(plugins, cfg.HomePath)
	provisioning := valueAsString(iniFile.Section("paths"), "provisioning", "")
	cfg.ProvisioningPath = makeAbsolute(provisioning, cfg.HomePath)

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

	if err := cfg.readProvisioningSettings(iniFile); err != nil {
		return err
	}

	// read dashboard settings
	dashboards := iniFile.Section("dashboards")
	cfg.DashboardVersionsToKeep = dashboards.Key("versions_to_keep").MustInt(20)
	cfg.MinRefreshInterval = valueAsString(dashboards, "min_refresh_interval", "5s")
	cfg.DefaultHomeDashboardPath = dashboards.Key("default_home_dashboard_path").MustString("")
	cfg.DashboardPerformanceMetrics = util.SplitString(dashboards.Key("dashboard_performance_metrics").MustString(""))
	cfg.PanelSeriesLimit = dashboards.Key("panel_series_limit").MustInt(0)

	if err := readUserSettings(iniFile, cfg); err != nil {
		return err
	}
	if err := readServiceAccountSettings(iniFile, cfg); err != nil {
		return err
	}
	if err := readAuthSettings(iniFile, cfg); err != nil {
		return err
	}

	readOAuth2ServerSettings(cfg)

	cfg.readRBACSettings()

	cfg.readZanzanaSettings()

	cfg.readRenderingSettings(iniFile)

	cfg.TempDataLifetime = iniFile.Section("paths").Key("temp_data_lifetime").MustDuration(time.Second * 3600 * 24)
	cfg.MetricsEndpointEnabled = iniFile.Section("metrics").Key("enabled").MustBool(true)
	cfg.MetricsEndpointBasicAuthUsername = valueAsString(iniFile.Section("metrics"), "basic_auth_username", "")
	cfg.MetricsEndpointBasicAuthPassword = valueAsString(iniFile.Section("metrics"), "basic_auth_password", "")
	cfg.MetricsEndpointDisableTotalStats = iniFile.Section("metrics").Key("disable_total_stats").MustBool(false)
	cfg.MetricsIncludeTeamLabel = iniFile.Section("metrics").Key("include_team_label").MustBool(false)
	cfg.MetricsTotalStatsIntervalSeconds = iniFile.Section("metrics").Key("total_stats_collector_interval_seconds").MustInt(1800)

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
	cfg.RudderstackIntegrationsURL = analytics.Key("rudderstack_integrations_url").String()
	cfg.IntercomSecret = analytics.Key("intercom_secret").String()
	cfg.FrontendAnalyticsConsoleReporting = analytics.Key("browser_console_reporter").MustBool(false)

	cfg.ReportingEnabled = analytics.Key("reporting_enabled").MustBool(true)
	cfg.ReportingDistributor = analytics.Key("reporting_distributor").MustString("grafana-labs")

	if len(cfg.ReportingDistributor) >= 100 {
		cfg.ReportingDistributor = cfg.ReportingDistributor[:100]
	}

	cfg.ApplicationInsightsConnectionString = analytics.Key("application_insights_connection_string").String()
	cfg.ApplicationInsightsEndpointUrl = analytics.Key("application_insights_endpoint_url").String()
	cfg.FeedbackLinksEnabled = analytics.Key("feedback_links_enabled").MustBool(true)

	// parse reporting static context string of key=value, key=value pairs into an object
	cfg.ReportingStaticContext = make(map[string]string)
	for _, pair := range strings.Split(analytics.Key("reporting_static_context").String(), ",") {
		kv := strings.Split(pair, "=")
		if len(kv) == 2 {
			cfg.ReportingStaticContext[strings.TrimSpace("_static_context_"+kv[0])] = strings.TrimSpace(kv[1])
		}
	}

	if err := cfg.readAlertingSettings(iniFile); err != nil {
		return err
	}

	explore := iniFile.Section("explore")
	cfg.ExploreEnabled = explore.Key("enabled").MustBool(true)

	exploreDefaultTimeOffset := valueAsString(explore, "defaultTimeOffset", "1h")
	// we want to ensure the value parses as a duration, but we send it forward as a string to the frontend
	if _, err := gtime.ParseDuration(exploreDefaultTimeOffset); err != nil {
		return err
	} else {
		cfg.ExploreDefaultTimeOffset = exploreDefaultTimeOffset
	}
	cfg.ExploreHideLogsDownload = explore.Key("hide_logs_download").MustBool(false)

	help := iniFile.Section("help")
	cfg.HelpEnabled = help.Key("enabled").MustBool(true)

	profile := iniFile.Section("profile")
	cfg.ProfileEnabled = profile.Key("enabled").MustBool(true)

	news := iniFile.Section("news")
	cfg.NewsFeedEnabled = news.Key("news_feed_enabled").MustBool(true)

	queryHistory := iniFile.Section("query_history")
	cfg.QueryHistoryEnabled = queryHistory.Key("enabled").MustBool(true)

	shortLinks := iniFile.Section("short_links")
	cfg.ShortLinkExpiration = shortLinks.Key("expire_time").MustInt(7)

	if cfg.ShortLinkExpiration > 365 {
		cfg.Logger.Warn("short_links expire_time must be less than 366 days. Setting to 365 days")
		cfg.ShortLinkExpiration = 365
	}

	panelsSection := iniFile.Section("panels")
	cfg.DisableSanitizeHtml = panelsSection.Key("disable_sanitize_html").MustBool(false)

	// nolint:staticcheck
	if err := cfg.readFeatureToggles(iniFile); err != nil {
		return err
	}

	if err := cfg.readPluginSettings(iniFile); err != nil {
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
	cfg.readAuthJWTSettings()
	cfg.readAuthExtJWTSettings()
	cfg.readAuthProxySettings()
	cfg.readSessionConfig()
	cfg.readPasswordlessMagicLinkSettings()
	if err := cfg.readSmtpSettings(); err != nil {
		return err
	}
	if err := cfg.readAnnotationSettings(); err != nil {
		return err
	}

	cfg.readQuotaSettings()

	cfg.readExpressionsSettings()
	if err := cfg.readGrafanaEnvironmentMetrics(); err != nil {
		return err
	}

	if err := cfg.readOpenFeatureSettings(); err != nil {
		cfg.Logger.Error("Failed to read open feature settings", "error", err)
		return err
	}

	cfg.readDataSourcesSettings()
	cfg.readDataSourceSecuritySettings()
	cfg.readK8sDashboardCleanupSettings()
	cfg.readSqlDataSourceSettings()

	cfg.Storage = readStorageSettings(iniFile)
	cfg.Search = readSearchSettings(iniFile)

	var err error
	cfg.SecureSocksDSProxy, err = readSecureSocksDSProxySettings(iniFile)
	if err != nil {
		// if the proxy is misconfigured, disable it rather than crashing
		cfg.SecureSocksDSProxy.Enabled = false
		cfg.Logger.Error("secure_socks_datasource_proxy unable to start up", "err", err.Error())
	}

	if cfg.VerifyEmailEnabled && !cfg.Smtp.Enabled {
		cfg.Logger.Warn("require_email_validation is enabled but smtp is disabled")
	}

	// check old key name
	grafanaComUrl := valueAsString(iniFile.Section("grafana_net"), "url", "")
	if grafanaComUrl == "" {
		grafanaComUrl = valueAsString(iniFile.Section("grafana_com"), "url", "https://grafana.com")
	}
	cfg.GrafanaComURL = grafanaComUrl

	cfg.GrafanaComAPIURL = valueAsString(iniFile.Section("grafana_com"), "api_url", grafanaComUrl+"/api")
	cfg.GrafanaComSSOAPIToken = valueAsString(iniFile.Section("grafana_com"), "sso_api_token", "")
	imageUploadingSection := iniFile.Section("external_image_storage")
	cfg.ImageUploadProvider = valueAsString(imageUploadingSection, "provider", "")

	enterprise := iniFile.Section("enterprise")
	cfg.EnterpriseLicensePath = valueAsString(enterprise, "license_path", filepath.Join(cfg.DataPath, "license.jwt"))

	geomapSection := iniFile.Section("geomap")
	basemapJSON := valueAsString(geomapSection, "default_baselayer_config", "")
	if basemapJSON != "" {
		layer := make(map[string]any)
		err := json.Unmarshal([]byte(basemapJSON), &layer)
		if err != nil {
			cfg.Logger.Error("Error reading json from default_baselayer_config", "error", err)
		} else {
			cfg.GeomapDefaultBaseLayerConfig = layer
		}
	}
	cfg.GeomapEnableCustomBaseLayers = geomapSection.Key("enable_custom_baselayers").MustBool(true)

	cfg.readRemoteCacheSettings()
	cfg.readDateFormats()
	cfg.readGrafanaJavascriptAgentConfig()

	if err := cfg.readLiveSettings(iniFile); err != nil {
		return err
	}

	databaseSection := iniFile.Section("database")
	cfg.DatabaseInstrumentQueries = databaseSection.Key("instrument_queries").MustBool(false)

	logSection := iniFile.Section("log")
	cfg.UserFacingDefaultError = logSection.Key("user_facing_default_error").MustString("please inspect Grafana server log for details")

	cfg.readFeatureManagementConfig()
	cfg.readPublicDashboardsSettings()
	cfg.readCloudMigrationSettings()
	cfg.readSecretsManagerSettings()

	// read experimental scopes settings.
	scopesSection := iniFile.Section("scopes")
	cfg.ScopesListScopesURL = scopesSection.Key("list_scopes_endpoint").MustString("")
	cfg.ScopesListDashboardsURL = scopesSection.Key("list_dashboards_endpoint").MustString("")

	// Time picker settings
	if err := cfg.readTimePicker(); err != nil {
		return err
	}

	// unified storage config
	cfg.setUnifiedStorageConfig()

	return nil
}

func valueAsString(section *ini.Section, keyName string, defaultValue string) string {
	return section.Key(keyName).MustString(defaultValue)
}

func (cfg *Cfg) readSAMLConfig() {
	samlSec := cfg.Raw.Section("auth.saml")
	cfg.SAMLAuthEnabled = samlSec.Key("enabled").MustBool(false)
	cfg.SAMLSkipOrgRoleSync = samlSec.Key("skip_org_role_sync").MustBool(false)
	cfg.SAMLRoleValuesGrafanaAdmin = samlSec.Key("role_values_grafana_admin").MustString("")
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
	cfg.AWSExternalId = awsPluginSec.Key("external_id").Value()
	cfg.AWSSessionDuration = awsPluginSec.Key("session_duration").Value()
	cfg.AWSForwardSettingsPlugins = util.SplitString(awsPluginSec.Key("forward_settings_to_plugins").String())

	// Also set environment variables that can be used by core plugins
	err := os.Setenv(awsds.AssumeRoleEnabledEnvVarKeyName, strconv.FormatBool(cfg.AWSAssumeRoleEnabled))
	if err != nil {
		cfg.Logger.Error(fmt.Sprintf("could not set environment variable '%s'", awsds.AssumeRoleEnabledEnvVarKeyName), err)
	}

	err = os.Setenv(awsds.AllowedAuthProvidersEnvVarKeyName, allowedAuthProviders)
	if err != nil {
		cfg.Logger.Error(fmt.Sprintf("could not set environment variable '%s'", awsds.AllowedAuthProvidersEnvVarKeyName), err)
	}

	err = os.Setenv(awsds.ListMetricsPageLimitKeyName, strconv.Itoa(cfg.AWSListMetricsPageLimit))
	if err != nil {
		cfg.Logger.Error(fmt.Sprintf("could not set environment variable '%s'", awsds.ListMetricsPageLimitKeyName), err)
	}

	err = os.Setenv(awsds.GrafanaAssumeRoleExternalIdKeyName, cfg.AWSExternalId)
	if err != nil {
		cfg.Logger.Error(fmt.Sprintf("could not set environment variable '%s'", awsds.GrafanaAssumeRoleExternalIdKeyName), err)
	}

	err = os.Setenv(awsds.SessionDurationEnvVarKeyName, cfg.AWSSessionDuration)
	if err != nil {
		cfg.Logger.Error(fmt.Sprintf("could not set environment variable '%s'", awsds.SessionDurationEnvVarKeyName), err)
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
	cfg.LogsPath = makeAbsolute(logsPath, cfg.HomePath)
	return log.ReadLoggingConfig(logModes, cfg.LogsPath, file)
}

func (cfg *Cfg) LogConfigSources() {
	var text bytes.Buffer

	for _, file := range cfg.configFiles {
		cfg.Logger.Info("Config loaded from", "file", file)
	}

	if len(cfg.appliedCommandLineProperties) > 0 {
		for _, prop := range cfg.appliedCommandLineProperties {
			cfg.Logger.Info("Config overridden from command line", "arg", prop)
		}
	}

	if len(cfg.appliedEnvOverrides) > 0 {
		text.WriteString("\tEnvironment variables used:\n")
		for _, prop := range cfg.appliedEnvOverrides {
			cfg.Logger.Info("Config overridden from Environment variable", "var", prop)
		}
	}

	cfg.Logger.Info("Target", "target", cfg.Target)
	cfg.Logger.Info("Path Home", "path", cfg.HomePath)
	cfg.Logger.Info("Path Data", "path", cfg.DataPath)
	cfg.Logger.Info("Path Logs", "path", cfg.LogsPath)
	cfg.Logger.Info("Path Plugins", "path", cfg.PluginsPath)
	cfg.Logger.Info("Path Provisioning", "path", cfg.ProvisioningPath)
	cfg.Logger.Info("App mode " + cfg.Env)
}

type DynamicSection struct {
	section *ini.Section
	Logger  log.Logger
	env     osutil.Env
}

// Key dynamically overrides keys with environment variables.
// As a side effect, the value of the setting key will be updated if an environment variable is present.
func (s *DynamicSection) Key(k string) *ini.Key {
	envKey := EnvKey(s.section.Name(), k)
	envValue := s.env.Getenv(envKey)
	key := s.section.Key(k)

	if len(envValue) == 0 {
		return key
	}

	key.SetValue(envValue)
	s.Logger.Info("Config overridden from Environment variable", "var", fmt.Sprintf("%s=%s", envKey, RedactedValue(envKey, envValue)))

	return key
}

func (s *DynamicSection) KeysHash() map[string]string {
	hash := s.section.KeysHash()
	for k := range hash {
		envKey := EnvKey(s.section.Name(), k)
		envValue := s.env.Getenv(envKey)
		if len(envValue) > 0 {
			hash[k] = envValue
		}
	}
	return hash
}

// SectionWithEnvOverrides dynamically overrides keys with environment variables.
// As a side effect, the value of the setting key will be updated if an environment variable is present.
func (cfg *Cfg) SectionWithEnvOverrides(s string) *DynamicSection {
	return &DynamicSection{
		section: cfg.Raw.Section(s),
		Logger:  cfg.Logger,
		env:     osutil.RealEnv{},
	}
}

func readSecuritySettings(iniFile *ini.File, cfg *Cfg) error {
	security := iniFile.Section("security")
	cfg.SecretKey = valueAsString(security, "secret_key", "")
	cfg.DisableGravatar = security.Key("disable_gravatar").MustBool(true)

	cfg.DisableBruteForceLoginProtection = security.Key("disable_brute_force_login_protection").MustBool(false)
	cfg.BruteForceLoginProtectionMaxAttempts = security.Key("brute_force_login_protection_max_attempts").MustInt64(5)
	cfg.DisableUsernameLoginProtection = security.Key("disable_username_login_protection").MustBool(false)
	cfg.DisableIPAddressLoginProtection = security.Key("disable_ip_address_login_protection").MustBool(true)

	// Ensure at least one login attempt can be performed.
	if cfg.BruteForceLoginProtectionMaxAttempts <= 0 {
		cfg.BruteForceLoginProtectionMaxAttempts = 1
	}

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
	cfg.ActionsAllowPostURL = security.Key("actions_allow_post_url").MustString("")
	cfg.StrictTransportSecurity = security.Key("strict_transport_security").MustBool(false)
	cfg.StrictTransportSecurityMaxAge = security.Key("strict_transport_security_max_age_seconds").MustInt(86400)
	cfg.StrictTransportSecurityPreload = security.Key("strict_transport_security_preload").MustBool(false)
	cfg.StrictTransportSecuritySubDomains = security.Key("strict_transport_security_subdomains").MustBool(false)
	cfg.CSPEnabled = security.Key("content_security_policy").MustBool(false)
	cfg.CSPTemplate = security.Key("content_security_policy_template").MustString("")
	cfg.CSPReportOnlyEnabled = security.Key("content_security_policy_report_only").MustBool(false)
	cfg.CSPReportOnlyTemplate = security.Key("content_security_policy_report_only_template").MustString("")

	enableFrontendSandboxForPlugins := security.Key("enable_frontend_sandbox_for_plugins").MustString("")
	for _, plug := range strings.Split(enableFrontendSandboxForPlugins, ",") {
		plug = strings.TrimSpace(plug)
		cfg.EnableFrontendSandboxForPlugins = append(cfg.EnableFrontendSandboxForPlugins, plug)
	}

	if cfg.CSPEnabled && cfg.CSPTemplate == "" {
		return fmt.Errorf("enabling content_security_policy requires a content_security_policy_template configuration")
	}

	if cfg.CSPReportOnlyEnabled && cfg.CSPReportOnlyTemplate == "" {
		return fmt.Errorf("enabling content_security_policy_report_only requires a content_security_policy_report_only_template configuration")
	}

	// read data source proxy whitelist
	cfg.DataProxyWhiteList = make(map[string]bool)
	securityStr := valueAsString(security, "data_source_proxy_whitelist", "")

	for _, hostAndIP := range util.SplitString(securityStr) {
		cfg.DataProxyWhiteList[hostAndIP] = true
	}

	// admin
	cfg.DisableInitAdminCreation = security.Key("disable_initial_admin_creation").MustBool(false)
	cfg.AdminUser = valueAsString(security, "admin_user", "")
	cfg.AdminPassword = valueAsString(security, "admin_password", "")
	cfg.AdminEmail = valueAsString(security, "admin_email", fmt.Sprintf("%s@localhost", cfg.AdminUser))

	return nil
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

	cfg.OAuthAllowInsecureEmailLookup = auth.Key("oauth_allow_insecure_email_lookup").MustBool(false)

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

	cfg.DisableLoginForm = auth.Key("disable_login_form").MustBool(false)
	cfg.DisableSignoutMenu = auth.Key("disable_signout_menu").MustBool(false)

	// Deprecated
	cfg.OAuthAutoLogin = auth.Key("oauth_auto_login").MustBool(false)
	if cfg.OAuthAutoLogin {
		cfg.Logger.Warn("[Deprecated] The oauth_auto_login configuration setting is deprecated. Please use auto_login inside auth provider section instead.")
	}

	// Default to the translation key used in the frontend
	cfg.OAuthLoginErrorMessage = valueAsString(auth, "oauth_login_error_message", "oauth.login.error")
	cfg.OAuthCookieMaxAge = auth.Key("oauth_state_cookie_max_age").MustInt(600)
	cfg.OAuthRefreshTokenServerLockMinWaitMs = auth.Key("oauth_refresh_token_server_lock_min_wait_ms").MustInt64(1000)
	cfg.SignoutRedirectUrl = valueAsString(auth, "signout_redirect_url", "")

	// Deprecated
	cfg.OAuthSkipOrgRoleUpdateSync = false

	cfg.DisableLogin = auth.Key("disable_login").MustBool(false)

	// SigV4
	cfg.SigV4AuthEnabled = auth.Key("sigv4_auth_enabled").MustBool(false)
	cfg.SigV4VerboseLogging = auth.Key("sigv4_verbose_logging").MustBool(false)

	// Azure Auth
	cfg.AzureAuthEnabled = auth.Key("azure_auth_enabled").MustBool(false)

	// ID response header
	cfg.IDResponseHeaderEnabled = auth.Key("id_response_header_enabled").MustBool(false)
	cfg.IDResponseHeaderPrefix = auth.Key("id_response_header_prefix").MustString("X-Grafana")

	idHeaderNamespaces := util.SplitString(auth.Key("id_response_header_namespaces").MustString(""))
	cfg.IDResponseHeaderNamespaces = make(map[string]struct{}, len(idHeaderNamespaces))
	for _, namespace := range idHeaderNamespaces {
		cfg.IDResponseHeaderNamespaces[namespace] = struct{}{}
	}

	// anonymous access
	cfg.readAnonymousSettings()

	// basic auth
	authBasic := iniFile.Section("auth.basic")
	cfg.BasicAuthEnabled = authBasic.Key("enabled").MustBool(true)
	cfg.BasicAuthStrongPasswordPolicy = authBasic.Key("password_policy").MustBool(false)

	// SSO Settings
	ssoSettings := iniFile.Section("sso_settings")
	cfg.SSOSettingsReloadInterval = ssoSettings.Key("reload_interval").MustDuration(1 * time.Minute)
	providers := ssoSettings.Key("configurable_providers").String()

	cfg.SSOSettingsConfigurableProviders = make(map[string]bool)
	for _, provider := range util.SplitString(providers) {
		cfg.SSOSettingsConfigurableProviders[provider] = true
	}

	// Managed Service Accounts
	cfg.ManagedServiceAccountsEnabled = auth.Key("managed_service_accounts_enabled").MustBool(false)

	return nil
}

func readOAuth2ServerSettings(cfg *Cfg) {
	oauth2Srv := cfg.SectionWithEnvOverrides("oauth2_server")
	cfg.OAuth2ServerEnabled = oauth2Srv.Key("enabled").MustBool(false)
	cfg.OAuth2ServerGeneratedKeyTypeForClient = strings.ToUpper(oauth2Srv.Key("generated_key_type_for_client").In("ECDSA", []string{"RSA", "ECDSA"}))
	cfg.OAuth2ServerAccessTokenLifespan = oauth2Srv.Key("access_token_lifespan").MustDuration(time.Minute * 3)
}

func readUserSettings(iniFile *ini.File, cfg *Cfg) error {
	users := iniFile.Section("users")
	cfg.AllowUserSignUp = users.Key("allow_sign_up").MustBool(true)
	cfg.AllowUserOrgCreate = users.Key("allow_org_create").MustBool(true)
	cfg.AutoAssignOrg = users.Key("auto_assign_org").MustBool(true)
	cfg.AutoAssignOrgId = users.Key("auto_assign_org_id").MustInt(1)
	cfg.LoginDefaultOrgId = users.Key("login_default_org_id").MustInt64(-1)
	cfg.AutoAssignOrgRole = users.Key("auto_assign_org_role").In(
		string(identity.RoleViewer), []string{
			string(identity.RoleNone),
			string(identity.RoleViewer),
			string(identity.RoleEditor),
			string(identity.RoleAdmin),
		})
	cfg.VerifyEmailEnabled = users.Key("verify_email_enabled").MustBool(false)

	// Deprecated
	// cfg.CaseInsensitiveLogin = users.Key("case_insensitive_login").MustBool(true)
	cfg.CaseInsensitiveLogin = true

	cfg.LoginHint = valueAsString(users, "login_hint", "")
	cfg.PasswordHint = valueAsString(users, "password_hint", "")
	cfg.DefaultTheme = valueAsString(users, "default_theme", "")
	cfg.DefaultLanguage = valueAsString(users, "default_language", "")
	cfg.HomePage = valueAsString(users, "home_page", "")
	cfg.ExternalUserMngLinkUrl = valueAsString(users, "external_manage_link_url", "")
	cfg.ExternalUserMngLinkName = valueAsString(users, "external_manage_link_name", "")
	cfg.ExternalUserMngInfo = valueAsString(users, "external_manage_info", "")
	cfg.ExternalUserMngAnalytics = users.Key("external_manage_analytics").MustBool(false)
	cfg.ExternalUserMngAnalyticsParams = valueAsString(users, "external_manage_analytics_params", "")

	//nolint:staticcheck
	cfg.ViewersCanEdit = users.Key("viewers_can_edit").MustBool(false)
	//nolint:staticcheck
	if cfg.ViewersCanEdit {
		cfg.Logger.Warn("[Deprecated] The viewers_can_edit configuration setting is deprecated. Please upgrade viewers to editors.")
	}

	userInviteMaxLifetimeVal := valueAsString(users, "user_invite_max_lifetime_duration", "24h")
	userInviteMaxLifetimeDuration, err := gtime.ParseDuration(userInviteMaxLifetimeVal)
	if err != nil {
		return err
	}

	cfg.UserInviteMaxLifetime = userInviteMaxLifetimeDuration
	if cfg.UserInviteMaxLifetime < time.Minute*15 {
		return errors.New("the minimum supported value for the `user_invite_max_lifetime_duration` configuration is 15m (15 minutes)")
	}

	cfg.UserLastSeenUpdateInterval, err = gtime.ParseDuration(valueAsString(users, "last_seen_update_interval", "15m"))
	if err != nil {
		return err
	}

	if cfg.UserLastSeenUpdateInterval < time.Minute*5 {
		cfg.Logger.Warn("the minimum supported value for the `last_seen_update_interval` configuration is 5m (5 minutes)")
		cfg.UserLastSeenUpdateInterval = time.Minute * 5
	} else if cfg.UserLastSeenUpdateInterval > time.Hour*1 {
		cfg.Logger.Warn("the maximum supported value for the `last_seen_update_interval` configuration is 1h (1 hour)")
		cfg.UserLastSeenUpdateInterval = time.Hour * 1
	}

	cfg.HiddenUsers = make(map[string]struct{})
	hiddenUsers := users.Key("hidden_users").MustString("")
	for _, user := range strings.Split(hiddenUsers, ",") {
		user = strings.TrimSpace(user)
		if user != "" {
			cfg.HiddenUsers[user] = struct{}{}
		}
	}

	verificationEmailMaxLifetimeVal := valueAsString(users, "verification_email_max_lifetime_duration", "1h")
	verificationEmailMaxLifetimeDuration, err := gtime.ParseDuration(verificationEmailMaxLifetimeVal)
	if err != nil {
		return err
	}
	cfg.VerificationEmailMaxLifetime = verificationEmailMaxLifetimeDuration

	return nil
}

func readServiceAccountSettings(iniFile *ini.File, cfg *Cfg) error {
	serviceAccount := iniFile.Section("service_accounts")
	cfg.SATokenExpirationDayLimit = serviceAccount.Key("token_expiration_day_limit").MustInt(-1)
	return nil
}

func (cfg *Cfg) readRenderingSettings(iniFile *ini.File) {
	renderSec := iniFile.Section("rendering")
	cfg.RendererServerUrl = valueAsString(renderSec, "server_url", "")
	cfg.RendererCallbackUrl = valueAsString(renderSec, "callback_url", "")
	cfg.RendererAuthToken = valueAsString(renderSec, "renderer_token", "-")

	cfg.RendererConcurrentRequestLimit = renderSec.Key("concurrent_render_request_limit").MustInt(30)
	cfg.RendererRenderKeyLifeTime = renderSec.Key("render_key_lifetime").MustDuration(5 * time.Minute)
	cfg.RendererDefaultImageWidth = renderSec.Key("default_image_width").MustInt(1000)
	cfg.RendererDefaultImageHeight = renderSec.Key("default_image_height").MustInt(500)
	cfg.RendererDefaultImageScale = renderSec.Key("default_image_scale").MustFloat64(1)
	cfg.ImagesDir = filepath.Join(cfg.DataPath, "png")
	cfg.CSVsDir = filepath.Join(cfg.DataPath, "csv")
	cfg.PDFsDir = filepath.Join(cfg.DataPath, "pdf")
}

func (cfg *Cfg) readAlertingSettings(iniFile *ini.File) error {
	// This check is kept to prevent users that upgrade to Grafana 11 with the legacy alerting enabled. This should prevent them from accidentally upgrading without migration to Unified Alerting.
	alerting := iniFile.Section("alerting")
	enabled, err := alerting.Key("enabled").Bool()
	if err == nil && enabled {
		cfg.Logger.Error("Option '[alerting].enabled' cannot be true. Legacy Alerting is removed. It is no longer deployed, enhanced, or supported. Delete '[alerting].enabled' and use '[unified_alerting].enabled' to enable Grafana Alerting. For more information, refer to the documentation on upgrading to Grafana Alerting (https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts)")
		return fmt.Errorf("invalid setting [alerting].enabled")
	}
	return nil
}

func readSnapshotsSettings(cfg *Cfg, iniFile *ini.File) error {
	snapshots := iniFile.Section("snapshots")

	cfg.SnapshotEnabled = snapshots.Key("enabled").MustBool(true)

	cfg.ExternalSnapshotUrl = valueAsString(snapshots, "external_snapshot_url", "")
	cfg.ExternalSnapshotName = valueAsString(snapshots, "external_snapshot_name", "")

	cfg.ExternalEnabled = snapshots.Key("external_enabled").MustBool(true)
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

	cfg.AppURL = AppUrl
	cfg.AppSubURL = AppSubUrl
	cfg.Protocol = HTTPScheme
	cfg.ServeFromSubPath = server.Key("serve_from_sub_path").MustBool(false)
	cfg.CertWatchInterval = server.Key("certs_watch_interval").MustDuration(0)

	protocolStr := valueAsString(server, "protocol", "http")

	if protocolStr == "https" {
		cfg.Protocol = HTTPSScheme
		cfg.CertFile = server.Key("cert_file").String()
		cfg.KeyFile = server.Key("cert_key").String()
		cfg.CertPassword = server.Key("cert_pass").String()
	}
	if protocolStr == "h2" {
		cfg.Protocol = HTTP2Scheme
		cfg.CertFile = server.Key("cert_file").String()
		cfg.KeyFile = server.Key("cert_key").String()
		cfg.CertPassword = server.Key("cert_pass").String()
	}
	if protocolStr == "socket" {
		cfg.Protocol = SocketScheme
		cfg.SocketGid = server.Key("socket_gid").MustInt(-1)
		cfg.SocketMode = server.Key("socket_mode").MustInt(0660)
		cfg.SocketPath = server.Key("socket").String()
	}

	cfg.MinTLSVersion = valueAsString(server, "min_tls_version", "TLS1.2")
	if cfg.MinTLSVersion == "TLS1.0" || cfg.MinTLSVersion == "TLS1.1" {
		return fmt.Errorf("TLS version not configured correctly:%v, allowed values are TLS1.2 and TLS1.3", cfg.MinTLSVersion)
	}

	cfg.Domain = valueAsString(server, "domain", "localhost")
	cfg.HTTPAddr = valueAsString(server, "http_addr", DefaultHTTPAddr)
	cfg.HTTPPort = valueAsString(server, "http_port", "3000")
	cfg.RouterLogging = server.Key("router_logging").MustBool(false)

	cfg.EnableGzip = server.Key("enable_gzip").MustBool(false)
	cfg.EnforceDomain = server.Key("enforce_domain").MustBool(false)
	staticRoot := valueAsString(server, "static_root_path", "")
	cfg.StaticRootPath = makeAbsolute(staticRoot, cfg.HomePath)

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
func (cfg *Cfg) GetContentDeliveryURL(prefix string) (string, error) {
	if cfg.CDNRootURL == nil {
		return "", nil
	}
	if cfg.BuildVersion == "" {
		return "", errors.New("BuildVersion is not set")
	}
	url := *cfg.CDNRootURL

	url.Path = path.Join(url.Path, prefix, cfg.BuildVersion)
	return url.String() + "/", nil
}

func (cfg *Cfg) readDataSourcesSettings() {
	datasources := cfg.Raw.Section("datasources")
	cfg.DataSourceLimit = datasources.Key("datasource_limit").MustInt(5000)
	cfg.ConcurrentQueryCount = datasources.Key("concurrent_query_count").MustInt(10)
	cfg.DefaultDatasourceManageAlertsUIToggle = datasources.Key("default_manage_alerts_ui_toggle").MustBool(true)
	cfg.DefaultAllowRecordingRulesTargetAlertsUIToggle = datasources.Key("default_allow_recording_rules_target_alerts_ui_toggle").MustBool(true)
}

func (cfg *Cfg) readDataSourceSecuritySettings() {
	datasources := cfg.Raw.Section("datasources.ip_range_security")
	cfg.IPRangeACEnabled = datasources.Key("enabled").MustBool(false)
	cfg.IPRangeACSecretKey = datasources.Key("secret_key").MustString("")
	if cfg.IPRangeACEnabled && cfg.IPRangeACSecretKey == "" {
		cfg.Logger.Error("IP range access control is enabled but no secret key is set")
	}
	allowedURLString := datasources.Key("allow_list").MustString("")
	for _, urlString := range util.SplitString(allowedURLString) {
		allowedURL, err := url.Parse(urlString)
		if err != nil {
			cfg.Logger.Error("Error parsing allowed URL for IP range access control", "error", err)
			continue
		} else {
			cfg.IPRangeACAllowedURLs = append(cfg.IPRangeACAllowedURLs, allowedURL)
		}
	}
}

func (cfg *Cfg) readSqlDataSourceSettings() {
	sqlDatasources := cfg.Raw.Section("sql_datasources")
	cfg.SqlDatasourceMaxOpenConnsDefault = sqlDatasources.Key("max_open_conns_default").MustInt(100)
	cfg.SqlDatasourceMaxIdleConnsDefault = sqlDatasources.Key("max_idle_conns_default").MustInt(100)
	cfg.SqlDatasourceMaxConnLifetimeDefault = sqlDatasources.Key("max_conn_lifetime_default").MustInt(14400)
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
	cfg.LiveMessageSizeLimit = section.Key("message_size_limit").MustInt(65536)
	if cfg.LiveMessageSizeLimit < -1 {
		return fmt.Errorf("unexpected value %d for [live] message_size_limit", cfg.LiveMaxConnections)
	}
	cfg.LiveHAEngine = section.Key("ha_engine").MustString("")
	switch cfg.LiveHAEngine {
	case "", "redis":
	default:
		return fmt.Errorf("unsupported live HA engine type: %s", cfg.LiveHAEngine)
	}
	cfg.LiveHAPrefix = section.Key("ha_prefix").MustString("")
	cfg.LiveHAEngineAddress = section.Key("ha_engine_address").MustString("127.0.0.1:6379")
	cfg.LiveHAEnginePassword = section.Key("ha_engine_password").MustString("")

	allowedOrigins := section.Key("allowed_origins").MustString("")
	origins := strings.Split(allowedOrigins, ",")

	originPatterns := make([]string, 0, len(origins))
	for _, originPattern := range origins {
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

func (cfg *Cfg) readProvisioningSettings(iniFile *ini.File) error {
	provisioning := valueAsString(iniFile.Section("paths"), "provisioning", "")
	cfg.ProvisioningPath = makeAbsolute(provisioning, cfg.HomePath)

	provisioningPaths := strings.TrimSpace(valueAsString(iniFile.Section("paths"), "permitted_provisioning_paths", ""))
	if provisioningPaths != "|" && provisioningPaths != "" {
		cfg.PermittedProvisioningPaths = strings.Split(provisioningPaths, "|")
		for i, s := range cfg.PermittedProvisioningPaths {
			s = strings.TrimSpace(s)
			if s == "" {
				return fmt.Errorf("a provisioning path is empty in '%s' (at index %d)", provisioningPaths, i)
			}
			cfg.PermittedProvisioningPaths[i] = makeAbsolute(s, cfg.HomePath)
		}
	}

	cfg.ProvisioningDisableControllers = iniFile.Section("provisioning").Key("disable_controllers").MustBool(false)

	// Read job history configuration
	cfg.ProvisioningLokiURL = valueAsString(iniFile.Section("provisioning"), "loki_url", "")
	cfg.ProvisioningLokiUser = valueAsString(iniFile.Section("provisioning"), "loki_user", "")
	cfg.ProvisioningLokiPassword = valueAsString(iniFile.Section("provisioning"), "loki_password", "")
	cfg.ProvisioningLokiTenantID = valueAsString(iniFile.Section("provisioning"), "loki_tenant_id", "")

	return nil
}

func (cfg *Cfg) readPublicDashboardsSettings() {
	publicDashboards := cfg.Raw.Section("public_dashboards")
	cfg.PublicDashboardsEnabled = publicDashboards.Key("enabled").MustBool(true)
}

func (cfg *Cfg) DefaultOrgID() int64 {
	if cfg.AutoAssignOrg && cfg.AutoAssignOrgId > 0 {
		return int64(cfg.AutoAssignOrgId)
	}
	return int64(1)
}

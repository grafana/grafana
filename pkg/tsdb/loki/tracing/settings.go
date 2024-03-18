package tracing

import (
	"crypto/tls"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"gopkg.in/ini.v1"
)

// TODO move these settings into `grafana-plugin-sdk-go/backend/settings` package
// TODO remove `any` type
type AnnotationCleanupSettings struct {
	MaxAge   time.Duration
	MaxCount int64
}
type PluginSettings map[string]map[string]string

type RemoteCacheOptions struct {
	Name       string
	ConnStr    string
	Prefix     string
	Encryption bool
}

type AuthProxySettings struct {
	// Auth Proxy
	Enabled          bool
	HeaderName       string
	HeaderProperty   string
	AutoSignUp       bool
	EnableLoginToken bool
	Whitelist        string
	Headers          map[string]string
	HeadersEncoded   bool
	SyncTTL          int
}
type StorageSettings struct {
	AllowUnsanitizedSvgUpload bool
}
type FeatureMgmtSettings struct {
	HiddenToggles      map[string]struct{}
	ReadOnlyToggles    map[string]struct{}
	AllowEditing       bool
	UpdateWebhook      string
	UpdateWebhookToken string
}
type Scheme string
type AuthJWTSettings struct {
	// JWT Auth
	Enabled                 bool
	HeaderName              string
	URLLogin                bool
	EmailClaim              string
	UsernameClaim           string
	ExpectClaims            string
	JWKSetURL               string
	CacheTTL                time.Duration
	KeyFile                 string
	KeyID                   string
	JWKSetFile              string
	AutoSignUp              bool
	RoleAttributePath       string
	RoleAttributeStrict     bool
	AllowAssignGrafanaAdmin bool
	SkipOrgRoleSync         bool
	GroupsAttributePath     string
}
type SmtpSettings struct {
	Enabled        bool
	Host           string
	User           string
	Password       string
	CertFile       string
	KeyFile        string
	FromAddress    string
	FromName       string
	EhloIdentity   string
	StartTLSPolicy string
	SkipVerify     bool
	StaticHeaders  map[string]string
	EnableTracing  bool

	SendWelcomeEmailOnSignUp bool
	TemplatesPatterns        []string
	ContentTypes             []string
}
// TODO move all global vars to this struct
type Cfg struct {
	Target []string
	Raw    *ini.File
	Logger log.Logger

	// TODO do we need these?
	// for logging purposes
	// configFiles                  []string
	// appliedCommandLineProperties []string
	// appliedEnvOverrides          []string

	// HTTP Server Settings
	CertFile         string
	KeyFile          string
	HTTPAddr         string
	HTTPPort         string
	Env              string
	AppURL           string
	AppSubURL        string
	InstanceName     string
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
	MinTLSVersion    string

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
	PDFsDir                        string
	RendererUrl                    string
	RendererCallbackUrl            string
	RendererAuthToken              string
	RendererConcurrentRequestLimit int
	RendererRenderKeyLifeTime      time.Duration
	RendererDefaultImageWidth      int
	RendererDefaultImageHeight     int
	RendererDefaultImageScale      float64

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
	CSPReportOnlyTemplate            string
	AngularSupportEnabled            bool
	DisableFrontendSandboxForPlugins []string
	DisableGravatar                  bool
	DataProxyWhiteList               map[string]bool

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
	HideAngularDeprecation           []string
	PluginInstallToken               string
	ForwardHostEnvVars               []string

	PluginsCDNURLTemplate    string
	PluginLogBackendRequests bool

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
	DashboardVersionsToKeep  int
	MinRefreshInterval       string
	DefaultHomeDashboardPath string

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
	// Not documented & not supported
	// stand in until a more complete solution is implemented
	AuthConfigUIAdminAccess bool

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
	OAuthAutoLogin                bool
	OAuthCookieMaxAge             int
	OAuthAllowInsecureEmailLookup bool

	JWTAuth AuthJWTSettings
	// Extended JWT Auth
	ExtendedJWTAuthEnabled    bool
	ExtendedJWTExpectIssuer   string
	ExtendedJWTExpectAudience string

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
	RemoteCacheOptions *RemoteCacheOptions

	ViewersCanEdit  bool
	EditorsCanAdmin bool

	ApiKeyMaxSecondsToLive int64

	// Check if a feature toggle is enabled
	// Deprecated: use featuremgmt.FeatureFlags
	IsFeatureToggleEnabled func(key string) bool // filled in dynamically

	AnonymousEnabled     bool
	AnonymousOrgName     string
	AnonymousOrgRole     string
	AnonymousHideVersion bool
	AnonymousDeviceLimit int64

	DateFormats any

	// User
	UserInviteMaxLifetime        time.Duration
	HiddenUsers                  map[string]struct{}
	CaseInsensitiveLogin         bool // Login and Email will be considered case insensitive
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
	GrafanaJavascriptAgent any

	// Data sources
	DataSourceLimit int
	// Number of queries to be executed concurrently. Only for the datasource supports concurrency.
	ConcurrentQueryCount int

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
	// Deprecated: setting this to false adds deprecation warnings at runtime
	SnapShotRemoveExpired bool

	// Only used in https://snapshots.raintank.io/
	SnapshotPublicMode bool

	ErrTemplateName string

	StackID string
	Slug    string

	LocalFileSystemAvailable bool

	// Deprecated
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
	RudderstackIntegrationsURL          string
	IntercomSecret                      string

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

	Quota any

	// User settings
	AllowUserSignUp            bool
	AllowUserOrgCreate         bool
	VerifyEmailEnabled         bool
	LoginHint                  string
	PasswordHint               string
	DisableSignoutMenu         bool
	ExternalUserMngLinkUrl     string
	ExternalUserMngLinkName    string
	ExternalUserMngInfo        string
	AutoAssignOrg              bool
	AutoAssignOrgId            int
	AutoAssignOrgRole          string
	LoginDefaultOrgId          int64
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
	LiveHAEngineAddress  string
	LiveHAEnginePassword string
	// LiveAllowedOrigins is a set of origins accepted by Live. If not provided
	// then Live uses AppURL as the only allowed origin.
	LiveAllowedOrigins []string

	// Grafana.com URL, used for OAuth redirect.
	GrafanaComURL string
	// Grafana.com API URL. Can be set separately to GrafanaComURL
	// in case API is not publicly accessible.
	// Defaults to GrafanaComURL setting + "/api" if unset.
	GrafanaComAPIURL string

	// Geomap base layer config
	GeomapDefaultBaseLayerConfig map[string]any
	GeomapEnableCustomBaseLayers bool

	// Unified Alerting
	UnifiedAlerting any

	// Query history
	QueryHistoryEnabled bool

	Storage StorageSettings

	Search any

	// TODO any
	SecureSocksDSProxy any

	// SAML Auth
	SAMLAuthEnabled            bool
	SAMLSkipOrgRoleSync        bool
	SAMLRoleValuesGrafanaAdmin string

	// OAuth2 Server
	OAuth2ServerEnabled bool

	// OAuth2Server supports the two recommended key types from the RFC https://www.rfc-editor.org/rfc/rfc7518#section-3.1: RS256 and ES256
	OAuth2ServerGeneratedKeyTypeForClient string
	OAuth2ServerAccessTokenLifespan       time.Duration

	// Access Control
	RBACPermissionCache bool
	// Enable Permission validation during role creation and provisioning
	RBACPermissionValidationEnabled bool
	// Reset basic roles permissions on start-up
	RBACResetBasicRoles bool
	// RBAC single organization. This configuration option is subject to change.
	RBACSingleOrganization bool

	// GRPC Server.
	GRPCServerNetwork   string
	GRPCServerAddress   string
	GRPCServerTLSConfig *tls.Config

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
	CloudMigrationIsTarget bool

	// Feature Management Settings
	FeatureManagement FeatureMgmtSettings

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

	// News Feed
	NewsFeedEnabled bool

	// Experimental scope settings
	ScopesListScopesURL     string
	ScopesListDashboardsURL string
}

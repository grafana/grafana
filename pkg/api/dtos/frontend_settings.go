package dtos

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type FrontendSettingsAuthDTO struct {
	OAuthSkipOrgRoleUpdateSync  bool `json:"OAuthSkipOrgRoleUpdateSync"`
	SAMLSkipOrgRoleSync         bool `json:"SAMLSkipOrgRoleSync"`
	LDAPSkipOrgRoleSync         bool `json:"LDAPSkipOrgRoleSync"`
	GoogleSkipOrgRoleSync       bool `json:"GoogleSkipOrgRoleSync"`
	GenericOAuthSkipOrgRoleSync bool `json:"GenericOAuthSkipOrgRoleSync"`
	JWTAuthSkipOrgRoleSync      bool `json:"JWTAuthSkipOrgRoleSync"`
	GrafanaComSkipOrgRoleSync   bool `json:"GrafanaComSkipOrgRoleSync"`
	AzureADSkipOrgRoleSync      bool `json:"AzureADSkipOrgRoleSync"`
	GithubSkipOrgRoleSync       bool `json:"GithubSkipOrgRoleSync"`
	GitLabSkipOrgRoleSync       bool `json:"GitLabSkipOrgRoleSync"`
	OktaSkipOrgRoleSync         bool `json:"OktaSkipOrgRoleSync"`
	DisableSyncLock             bool `json:"DisableSyncLock"`
}

type FrontendSettingsBuildInfoDTO struct {
	HideVersion   bool   `json:"hideVersion"`
	Version       string `json:"version"`
	Commit        string `json:"commit"`
	Buildstamp    int64  `json:"buildstamp"`
	Edition       string `json:"edition"`
	LatestVersion string `json:"latestVersion"`
	HasUpdate     bool   `json:"hasUpdate"`
	Env           string `json:"env"`
}

type FrontendSettingsLicenseInfoDTO struct {
	Expiry          int64           `json:"expiry"`
	StateInfo       string          `json:"stateInfo"`
	LicenseUrl      string          `json:"licenseUrl"`
	Edition         string          `json:"edition"`
	EnabledFeatures map[string]bool `json:"enabledFeatures"`

	// Enterprise-only
	TrialExpiry *int64  `json:"trialExpiry,omitempty"`
	AppUrl      *string `json:"appUrl,omitempty"`
}

type FrontendSettingsAzureDTO struct {
	Cloud                  string `json:"cloud"`
	ManagedIdentityEnabled bool   `json:"managedIdentityEnabled"`
	UserIdentityEnabled    bool   `json:"userIdentityEnabled"`
}

type FrontendSettingsCachingDTO struct {
	Enabled bool `json:"enabled"`
}

type FrontendSettingsRecordedQueriesDTO struct {
	Enabled bool `json:"enabled"`
}

type FrontendSettingsReportingDTO struct {
	Enabled bool `json:"enabled"`
}

type FrontendSettingsUnifiedAlertingDTO struct {
	MinInterval              string `json:"minInterval"`
	AlertStateHistoryBackend string `json:"alertStateHistoryBackend,omitempty"`
	AlertStateHistoryPrimary string `json:"alertStateHistoryPrimary,omitempty"`
}

// Enterprise-only
type FrontendSettingsLicensingDTO struct {
	Slug                   *string `json:"slug,omitempty"`
	LimitBy                *string `json:"limitBy,omitempty"`
	IncludedUsers          *int64  `json:"includedUsers,omitempty"`
	LicenseExpiry          *int64  `json:"licenseExpiry,omitempty"`
	LicenseExpiryWarnDays  *int64  `json:"licenseExpiryWarnDays,omitempty"`
	TokenExpiry            *int64  `json:"tokenExpiry,omitempty"`
	IsTrial                *bool   `json:"isTrial,omitempty"`
	TokenExpiryWarnDays    *int64  `json:"tokenExpiryWarnDays,omitempty"`
	UsageBilling           *bool   `json:"usageBilling,omitempty"`
	ActiveAdminsAndEditors *int64  `json:"activeAdminsAndEditors,omitempty"`
	ActiveViewers          *int64  `json:"activeViewers,omitempty"`
	ActiveUsers            *int64  `json:"ActiveUsers,omitempty"`
}

// Enterprise-only
type FrontendSettingsFooterConfigItemDTO struct {
	Text   string `json:"text"`
	Url    string `json:"url"`
	Icon   string `json:"icon"`
	Target string `json:"blank"`
}

// Enterprise-only
type FrontendSettingsPublicDashboardFooterConfigDTO struct {
	Hide bool   `json:"hide"`
	Text string `json:"text"`
	Logo string `json:"logo"`
	Link string `json:"link"`
}

// Enterprise-only
type FrontendSettingsWhitelabelingDTO struct {
	Links      []FrontendSettingsFooterConfigItemDTO `json:"links"`
	LoginTitle string                                `json:"loginTitle"`

	AppTitle              *string                                         `json:"appTitle,omitempty"`
	LoginLogo             *string                                         `json:"loginLogo,omitempty"`
	MenuLogo              *string                                         `json:"menuLogo,omitempty"`
	LoginBackground       *string                                         `json:"loginBackground,omitempty"`
	LoginSubtitle         *string                                         `json:"loginSubtitle,omitempty"`
	LoginBoxBackground    *string                                         `json:"loginBoxBackground,omitempty"`
	LoadingLogo           *string                                         `json:"loadingLogo,omitempty"`
	PublicDashboardFooter *FrontendSettingsPublicDashboardFooterConfigDTO `json:"publicDashboardFooter,omitempty"` // PR TODO: type this properly
}

type FrontendSettingsSqlConnectionLimitsDTO struct {
	MaxOpenConns    int `json:"maxOpenConns"`
	MaxIdleConns    int `json:"maxIdleConns"`
	ConnMaxLifetime int `json:"connMaxLifetime"`
}

type FrontendSettingsDTO struct {
	DefaultDatasource          string                           `json:"defaultDatasource"`
	Datasources                map[string]plugins.DataSourceDTO `json:"datasources"`
	MinRefreshInterval         string                           `json:"minRefreshInterval"`
	Panels                     map[string]plugins.PanelDTO      `json:"panels"`
	Apps                       map[string]*plugins.AppDTO       `json:"apps"`
	AppUrl                     string                           `json:"appUrl"`
	AppSubUrl                  string                           `json:"appSubUrl"`
	AllowOrgCreate             bool                             `json:"allowOrgCreate"`
	AuthProxyEnabled           bool                             `json:"authProxyEnabled"`
	LdapEnabled                bool                             `json:"ldapEnabled"`
	JwtHeaderName              string                           `json:"jwtHeaderName"`
	JwtUrlLogin                bool                             `json:"jwtUrlLogin"`
	AlertingEnabled            bool                             `json:"alertingEnabled"`
	AlertingErrorOrTimeout     string                           `json:"alertingErrorOrTimeout"`
	AlertingNoDataOrNullValues string                           `json:"alertingNoDataOrNullValues"`
	AlertingMinInterval        int64                            `json:"alertingMinInterval"`
	LiveEnabled                bool                             `json:"liveEnabled"`
	AutoAssignOrg              bool                             `json:"autoAssignOrg"`

	VerifyEmailEnabled  bool `json:"verifyEmailEnabled"`
	SigV4AuthEnabled    bool `json:"sigV4AuthEnabled"`
	AzureAuthEnabled    bool `json:"azureAuthEnabled"`
	RbacEnabled         bool `json:"rbacEnabled"`
	ExploreEnabled      bool `json:"exploreEnabled"`
	HelpEnabled         bool `json:"helpEnabled"`
	ProfileEnabled      bool `json:"profileEnabled"`
	NewsFeedEnabled     bool `json:"newsFeedEnabled"`
	QueryHistoryEnabled bool `json:"queryHistoryEnabled"`

	GoogleAnalyticsId                   string `json:"googleAnalyticsId"`
	GoogleAnalytics4Id                  string `json:"googleAnalytics4Id"`
	GoogleAnalytics4SendManualPageViews bool   `json:"GoogleAnalytics4SendManualPageViews"`

	RudderstackWriteKey     string `json:"rudderstackWriteKey"`
	RudderstackDataPlaneUrl string `json:"rudderstackDataPlaneUrl"`
	RudderstackSdkUrl       string `json:"rudderstackSdkUrl"`
	RudderstackConfigUrl    string `json:"rudderstackConfigUrl"`

	FeedbackLinksEnabled                bool     `json:"feedbackLinksEnabled"`
	ApplicationInsightsConnectionString string   `json:"applicationInsightsConnectionString"`
	ApplicationInsightsEndpointUrl      string   `json:"applicationInsightsEndpointUrl"`
	DisableLoginForm                    bool     `json:"disableLoginForm"`
	DisableUserSignUp                   bool     `json:"disableUserSignUp"`
	LoginHint                           string   `json:"loginHint"`
	PasswordHint                        string   `json:"passwordHint"`
	ExternalUserMngInfo                 string   `json:"externalUserMngInfo"`
	ExternalUserMngLinkUrl              string   `json:"externalUserMngLinkUrl"`
	ExternalUserMngLinkName             string   `json:"externalUserMngLinkName"`
	ViewersCanEdit                      bool     `json:"viewersCanEdit"`
	AngularSupportEnabled               bool     `json:"angularSupportEnabled"`
	EditorsCanAdmin                     bool     `json:"editorsCanAdmin"`
	DisableSanitizeHtml                 bool     `json:"disableSanitizeHtml"`
	TrustedTypesDefaultPolicyEnabled    bool     `json:"trustedTypesDefaultPolicyEnabled"`
	CSPReportOnlyEnabled                bool     `json:"cspReportOnlyEnabled"`
	DisableFrontendSandboxForPlugins    []string `json:"disableFrontendSandboxForPlugins"`

	Auth FrontendSettingsAuthDTO `json:"auth"`

	BuildInfo FrontendSettingsBuildInfoDTO `json:"buildInfo"`

	LicenseInfo FrontendSettingsLicenseInfoDTO `json:"licenseInfo"`

	FeatureToggles                   map[string]bool                `json:"featureToggles"`
	AnonymousEnabled                 bool                           `json:"anonymousEnabled"`
	RendererAvailable                bool                           `json:"rendererAvailable"`
	RendererVersion                  string                         `json:"rendererVersion"`
	SecretsManagerPluginEnabled      bool                           `json:"secretsManagerPluginEnabled"`
	Http2Enabled                     bool                           `json:"http2Enabled"`
	GrafanaJavascriptAgent           setting.GrafanaJavascriptAgent `json:"grafanaJavascriptAgent"`
	PluginCatalogURL                 string                         `json:"pluginCatalogURL"`
	PluginAdminEnabled               bool                           `json:"pluginAdminEnabled"`
	PluginAdminExternalManageEnabled bool                           `json:"pluginAdminExternalManageEnabled"`
	PluginCatalogHiddenPlugins       []string                       `json:"pluginCatalogHiddenPlugins"`
	ExpressionsEnabled               bool                           `json:"expressionsEnabled"`
	AwsAllowedAuthProviders          []string                       `json:"awsAllowedAuthProviders"`
	AwsAssumeRoleEnabled             bool                           `json:"awsAssumeRoleEnabled"`
	SupportBundlesEnabled            bool                           `json:"supportBundlesEnabled"`
	SnapshotEnabled                  bool                           `json:"snapshotEnabled"`
	SecureSocksDSProxyEnabled        bool                           `json:"secureSocksDSProxyEnabled"`

	Azure FrontendSettingsAzureDTO `json:"azure"`

	Caching                 FrontendSettingsCachingDTO         `json:"caching"`
	RecordedQueries         FrontendSettingsRecordedQueriesDTO `json:"recordedQueries"`
	Reporting               FrontendSettingsReportingDTO       `json:"reporting"`
	UnifiedAlertingEnabled  bool                               `json:"unifiedAlertingEnabled"`
	UnifiedAlerting         FrontendSettingsUnifiedAlertingDTO `json:"unifiedAlerting"`
	Oauth                   map[string]interface{}             `json:"oauth"`
	SamlEnabled             bool                               `json:"samlEnabled"`
	SamlName                string                             `json:"samlName"`
	TokenExpirationDayLimit int                                `json:"tokenExpirationDayLimit"`

	GeomapDefaultBaseLayerConfig *map[string]interface{} `json:"geomapDefaultBaseLayerConfig,omitempty"`
	GeomapDisableCustomBaseLayer bool                    `json:"geomapDisableCustomBaseLayer"`

	IsPublicDashboardView bool `json:"isPublicDashboardView"`

	DateFormats setting.DateFormats `json:"dateFormats,omitempty"`

	LoginError string `json:"loginError,omitempty"`

	PluginsCDNBaseURL string `json:"pluginsCDNBaseURL,omitempty"`

	SqlConnectionLimits FrontendSettingsSqlConnectionLimitsDTO `json:"sqlConnectionLimits"`

	// Enterprise
	Licensing     *FrontendSettingsLicensingDTO     `json:"licensing,omitempty"`
	Whitelabeling *FrontendSettingsWhitelabelingDTO `json:"whitelabeling,omitempty"`
}

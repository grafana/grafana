// Package frontendsettings builds the frontend settings DTO that initializes
// the Grafana web app. It is split out from pkg/api so callers (e.g. the
// frontend service) can depend on it without pulling in the full HTTP API.
package frontendsettings

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// GetBaseFrontendSettings returns the JSON object with all the settings needed for
// front end initialisation.
func GetBaseFrontendSettings(reqCtx *contextmodel.ReqContext, cfg *setting.Cfg, license licensing.Licensing, pluginsCDN *pluginscdn.Service) (*dtos.FrontendSettingsDTO, error) {
	defaultDS := "-- Grafana --"

	trustedTypesDefaultPolicyEnabled := (cfg.CSPEnabled && strings.Contains(cfg.CSPTemplate, "require-trusted-types-for")) || (cfg.CSPReportOnlyEnabled && strings.Contains(cfg.CSPReportOnlyTemplate, "require-trusted-types-for"))
	isCloudMigrationTarget := cfg.CloudMigration.Enabled && cfg.CloudMigration.IsTarget

	version := setting.BuildVersion
	commitShort := getShortCommitHash(setting.BuildCommit, 10)

	frontendSettings := &dtos.FrontendSettingsDTO{
		DefaultDatasource:                    defaultDS,
		Datasources:                          make(map[string]plugins.DataSourceDTO),
		MinRefreshInterval:                   cfg.MinRefreshInterval,
		Panels:                               make(map[string]plugins.PanelDTO),
		Apps:                                 make(map[string]*plugins.AppDTO, 0),
		AppUrl:                               cfg.AppURL,
		AppSubUrl:                            cfg.AppSubURL,
		AllowOrgCreate:                       (cfg.AllowUserOrgCreate && reqCtx.IsSignedIn) || reqCtx.IsGrafanaAdmin,
		AuthProxyEnabled:                     cfg.AuthProxy.Enabled,
		LdapEnabled:                          cfg.LDAPAuthEnabled,
		JwtHeaderName:                        cfg.JWTAuth.HeaderName,
		JwtUrlLogin:                          cfg.JWTAuth.URLLogin,
		LiveEnabled:                          cfg.LiveMaxConnections != 0,
		LiveMessageSizeLimit:                 cfg.LiveMessageSizeLimit,
		LiveNamespaced:                       true, // frontend will select a namespaced channel vs orgId channel
		AutoAssignOrg:                        cfg.AutoAssignOrg,
		VerifyEmailEnabled:                   cfg.VerifyEmailEnabled,
		SigV4AuthEnabled:                     cfg.SigV4AuthEnabled,
		AzureAuthEnabled:                     cfg.AzureAuthEnabled,
		RbacEnabled:                          true,
		ExploreEnabled:                       cfg.ExploreEnabled,
		HelpEnabled:                          cfg.HelpEnabled,
		ProfileEnabled:                       cfg.ProfileEnabled,
		NewsFeedEnabled:                      cfg.NewsFeedEnabled,
		QueryHistoryEnabled:                  cfg.QueryHistoryEnabled,
		AnnotationAppPlatformEnabled:         cfg.AnnotationAppPlatform.Enabled,
		GoogleAnalyticsId:                    cfg.GoogleAnalyticsID,
		GoogleAnalytics4Id:                   cfg.GoogleAnalytics4ID,
		GoogleAnalytics4SendManualPageViews:  cfg.GoogleAnalytics4SendManualPageViews,
		RudderstackWriteKey:                  cfg.RudderstackWriteKey,
		RudderstackDataPlaneUrl:              cfg.RudderstackDataPlaneURL,
		RudderstackSdkUrl:                    cfg.RudderstackSDKURL,
		RudderstackV3SdkUrl:                  cfg.RudderstackV3SDKURL,
		RudderstackConfigUrl:                 cfg.RudderstackConfigURL,
		RudderstackIntegrationsUrl:           cfg.RudderstackIntegrationsURL,
		PostHogToken:                         cfg.PostHogToken,
		PostHogHost:                          cfg.PostHogHost,
		AnalyticsConsoleReporting:            cfg.FrontendAnalyticsConsoleReporting,
		DashboardPerformanceMetrics:          cfg.DashboardPerformanceMetrics,
		PanelSeriesLimit:                     cfg.PanelSeriesLimit,
		FeedbackLinksEnabled:                 cfg.FeedbackLinksEnabled,
		ApplicationInsightsConnectionString:  cfg.ApplicationInsightsConnectionString,
		ApplicationInsightsEndpointUrl:       cfg.ApplicationInsightsEndpointUrl,
		ApplicationInsightsAutoRouteTracking: cfg.ApplicationInsightsAutoRouteTracking,
		DisableLoginForm:                     cfg.DisableLoginForm,
		DisableUserSignUp:                    !cfg.AllowUserSignUp,
		LoginHint:                            cfg.LoginHint,
		PasswordHint:                         cfg.PasswordHint,
		ExternalUserMngInfo:                  cfg.ExternalUserMngInfo,
		ExternalUserMngLinkUrl:               cfg.ExternalUserMngLinkUrl,
		ExternalUserMngLinkName:              cfg.ExternalUserMngLinkName,
		ExternalUserMngAnalytics:             cfg.ExternalUserMngAnalytics,
		ExternalUserMngAnalyticsParams:       cfg.ExternalUserMngAnalyticsParams,
		ExternalUserUpgradeLinkUrl:           cfg.ExternalUserUpgradeLinkUrl,
		//nolint:staticcheck // ViewersCanEdit is deprecated but still used for backward compatibility
		ViewersCanEdit:                   cfg.ViewersCanEdit,
		DisableSanitizeHtml:              cfg.DisableSanitizeHtml,
		TrustedTypesDefaultPolicyEnabled: trustedTypesDefaultPolicyEnabled,
		CSPReportOnlyEnabled:             cfg.CSPReportOnlyEnabled,
		DateFormats:                      cfg.DateFormats,
		QuickRanges:                      cfg.QuickRanges,
		SecureSocksDSProxyEnabled:        cfg.SecureSocksDSProxy.Enabled && cfg.SecureSocksDSProxy.ShowUI,
		EnableFrontendSandboxForPlugins:  cfg.EnableFrontendSandboxForPlugins,
		PluginRestrictedAPIsAllowList:    cfg.PluginRestrictedAPIsAllowList,
		PluginRestrictedAPIsBlockList:    cfg.PluginRestrictedAPIsBlockList,
		PublicDashboardAccessToken:       reqCtx.PublicDashboardAccessToken,
		PublicDashboardsEnabled:          cfg.PublicDashboardsEnabled,
		CloudMigrationEnabled:            cfg.CloudMigration.Enabled,
		CloudMigrationIsTarget:           isCloudMigrationTarget,
		CloudMigrationPollIntervalMs:     int(cfg.CloudMigration.FrontendPollInterval.Milliseconds()),
		SharedWithMeFolderUID:            folder.SharedWithMeFolderUID,
		RootFolderUID:                    accesscontrol.GeneralFolderUID,
		LocalFileSystemAvailable:         cfg.LocalFileSystemAvailable,
		ReportingStaticContext:           cfg.ReportingStaticContext,
		ExploreDefaultTimeOffset:         cfg.ExploreDefaultTimeOffset,
		ExploreHideLogsDownload:          cfg.ExploreHideLogsDownload,

		DefaultDatasourceManageAlertsUIToggle:          cfg.DefaultDatasourceManageAlertsUIToggle,
		DefaultAllowRecordingRulesTargetAlertsUIToggle: cfg.DefaultAllowRecordingRulesTargetAlertsUIToggle,

		BuildInfo: dtos.FrontendSettingsBuildInfoDTO{
			HideVersion:   false,
			Version:       version,
			VersionString: fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, version, commitShort),
			Commit:        setting.BuildCommit,
			CommitShort:   commitShort,
			Buildstamp:    setting.BuildStamp,
			Edition:       license.Edition(),
			Env:           cfg.Env,
		},

		LicenseInfo: dtos.FrontendSettingsLicenseInfoDTO{
			Expiry:          license.Expiry(),
			StateInfo:       license.StateInfo(),
			Edition:         license.Edition(),
			EnabledFeatures: license.EnabledFeatures(),
		},

		FeatureToggles:                   make(map[string]bool),
		AnonymousEnabled:                 cfg.Anonymous.Enabled,
		AnonymousDeviceLimit:             cfg.Anonymous.DeviceLimit,
		RendererDefaultImageWidth:        cfg.RendererDefaultImageWidth,
		RendererDefaultImageHeight:       cfg.RendererDefaultImageHeight,
		RendererDefaultImageScale:        cfg.RendererDefaultImageScale,
		Http2Enabled:                     cfg.Protocol == setting.HTTP2Scheme || cfg.Protocol == setting.SocketHTTP2Scheme,
		GrafanaJavascriptAgent:           cfg.GrafanaJavascriptAgent,
		PluginCatalogURL:                 cfg.PluginCatalogURL,
		PluginAdminEnabled:               cfg.PluginAdminEnabled,
		PluginAdminExternalManageEnabled: cfg.PluginAdminEnabled && cfg.PluginAdminExternalManageEnabled,
		PluginCatalogHiddenPlugins:       cfg.PluginCatalogHiddenPlugins,
		PluginCatalogManagedPlugins:      []string{},

		PluginCatalogPreinstalledPlugins:    append(cfg.PreinstallPluginsAsync, cfg.PreinstallPluginsSync...),
		PluginCatalogPreinstalledAutoUpdate: cfg.PreinstallAutoUpdate,
		ExpressionsEnabled:                  cfg.ExpressionsEnabled,
		AwsAllowedAuthProviders:             cfg.AWSAllowedAuthProviders,
		AwsAssumeRoleEnabled:                cfg.AWSAssumeRoleEnabled,
		AwsPerDatasourceHTTPProxyEnabled:    cfg.AWSPerDatasourceHTTPProxyEnabled,
		SupportBundlesEnabled:               isSupportBundlesEnabled(cfg),

		Azure: dtos.FrontendSettingsAzureDTO{
			Cloud:                                  cfg.Azure.Cloud,
			Clouds:                                 cfg.Azure.CustomClouds(),
			ManagedIdentityEnabled:                 cfg.Azure.ManagedIdentityEnabled,
			WorkloadIdentityEnabled:                cfg.Azure.WorkloadIdentityEnabled,
			UserIdentityEnabled:                    cfg.Azure.UserIdentityEnabled,
			UserIdentityFallbackCredentialsEnabled: cfg.Azure.UserIdentityFallbackCredentialsEnabled,
			AzureEntraPasswordCredentialsEnabled:   cfg.Azure.AzureEntraPasswordCredentialsEnabled,
		},

		Caching: dtos.FrontendSettingsCachingDTO{
			Enabled:           cfg.SectionWithEnvOverrides("caching").Key("enabled").MustBool(true),
			CleanCacheEnabled: cfg.SectionWithEnvOverrides("caching").Key("clean_cache_enabled").MustBool(true),
			DefaultTTLMs:      cfg.SectionWithEnvOverrides("caching").Key("ttl").MustDuration(time.Minute * 5).Milliseconds(),
		},
		RecordedQueries: dtos.FrontendSettingsRecordedQueriesDTO{
			Enabled: cfg.SectionWithEnvOverrides("recorded_queries").Key("enabled").MustBool(true),
		},
		Reporting: dtos.FrontendSettingsReportingDTO{
			Enabled: cfg.SectionWithEnvOverrides("reporting").Key("enabled").MustBool(true),
		},
		Analytics: dtos.FrontendSettingsAnalyticsDTO{
			Enabled: cfg.SectionWithEnvOverrides("analytics").Key("enabled").MustBool(true),
		},
		Passkey: passkeyFrontendSettings(cfg),

		UnifiedAlerting: dtos.FrontendSettingsUnifiedAlertingDTO{
			MinInterval: cfg.UnifiedAlerting.MinInterval.String(),
		},

		TokenExpirationDayLimit: cfg.SATokenExpirationDayLimit,

		SnapshotEnabled: cfg.SnapshotEnabled,

		SqlConnectionLimits: dtos.FrontendSettingsSqlConnectionLimitsDTO{
			MaxOpenConns:    cfg.SqlDatasourceMaxOpenConnsDefault,
			MaxIdleConns:    cfg.SqlDatasourceMaxIdleConnsDefault,
			ConnMaxLifetime: cfg.SqlDatasourceMaxConnLifetimeDefault,
		},
		OpenFeatureContext: cfg.OpenFeature.ContextAttrs,
	}

	if cfg.UnifiedAlerting.StateHistory.Enabled {
		frontendSettings.UnifiedAlerting.StateHistory = &dtos.FrontendSettingsUnifiedAlertingStateHistoryDTO{
			Backend: cfg.UnifiedAlerting.StateHistory.Backend,
			Primary: cfg.UnifiedAlerting.StateHistory.MultiPrimary,
		}
		if cfg.UnifiedAlerting.StateHistory.PrometheusTargetDatasourceUID != "" {
			frontendSettings.UnifiedAlerting.StateHistory.PrometheusTargetDatasourceUID = cfg.UnifiedAlerting.StateHistory.PrometheusTargetDatasourceUID
		}
		if cfg.UnifiedAlerting.StateHistory.PrometheusMetricName != "" {
			frontendSettings.UnifiedAlerting.StateHistory.PrometheusMetricName = cfg.UnifiedAlerting.StateHistory.PrometheusMetricName
		}

		// Populate deprecated fields for backward compatibility
		frontendSettings.UnifiedAlerting.AlertStateHistoryBackend = cfg.UnifiedAlerting.StateHistory.Backend
		frontendSettings.UnifiedAlerting.AlertStateHistoryPrimary = cfg.UnifiedAlerting.StateHistory.MultiPrimary
	}

	frontendSettings.UnifiedAlerting.RecordingRulesEnabled = cfg.UnifiedAlerting.RecordingRules.Enabled
	frontendSettings.UnifiedAlerting.DefaultRecordingRulesTargetDatasourceUID = cfg.UnifiedAlerting.RecordingRules.DefaultDatasourceUID

	if cfg.UnifiedAlerting.Enabled != nil {
		frontendSettings.UnifiedAlertingEnabled = *cfg.UnifiedAlerting.Enabled
	}

	if cfg.GeomapDefaultBaseLayerConfig != nil {
		frontendSettings.GeomapDefaultBaseLayerConfig = &cfg.GeomapDefaultBaseLayerConfig
	}

	if !cfg.GeomapEnableCustomBaseLayers {
		frontendSettings.GeomapDisableCustomBaseLayer = true
	}

	if pluginsCDN != nil && pluginsCDN.IsEnabled() {
		cdnBaseURL, err := pluginsCDN.BaseURL()
		if err != nil {
			return nil, fmt.Errorf("plugins cdn base url: %w", err)
		}
		frontendSettings.PluginsCDNBaseURL = cdnBaseURL
	}

	// Set the kubernetes namespace

	// [TODO] Restore namespace in the frontend service from baggage or context

	return frontendSettings, nil
}

func isSupportBundlesEnabled(cfg *setting.Cfg) bool {
	return cfg.SectionWithEnvOverrides("support_bundles").Key("enabled").MustBool(true)
}

// passkeyFrontendSettings returns the passkey block for bootData, or nil when the
// feature is off. Returning nil keeps the field out of the JSON entirely so the
// frontend's `config.passkey?.enabled` check resolves to false without ambiguity.
func passkeyFrontendSettings(cfg *setting.Cfg) *dtos.FrontendSettingsPasskeyDTO {
	if !cfg.Passkey.Enabled {
		return nil
	}
	return &dtos.FrontendSettingsPasskeyDTO{Enabled: true, RPID: cfg.Passkey.RPID}
}

func getShortCommitHash(commitHash string, maxLength int) string {
	if len(commitHash) > maxLength {
		return commitHash[:maxLength]
	}
	return commitHash
}

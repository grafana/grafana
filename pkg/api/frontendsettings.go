package api

import (
	"context"
	"crypto/sha256"
	"fmt"
	"hash"
	"net/http"
	"slices"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/util"
)

// GetBootdataAPI returns the same data we currently have rendered into index.html
// NOTE: this should not be added to the public API docs, and is useful for a transition
// towards a fully static index.html -- this will likely be replaced with multiple calls
func (hs *HTTPServer) GetBootdata(c *contextmodel.ReqContext) {
	data, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(hs.Cfg, http.StatusInternalServerError, "Failed to get settings", err)
		return
	}
	c.JSON(http.StatusOK, data)
}

// Returns a file that is easy to check for changes
// Any changes to the file means we should refresh the frontend
func (hs *HTTPServer) GetFrontendAssets(c *contextmodel.ReqContext) {
	c, span := hs.injectSpan(c, "api.GetFrontendAssets")
	defer span.End()

	hash := sha256.New()
	keys := map[string]any{}

	// BuildVersion
	hash.Reset()
	_, _ = hash.Write([]byte(setting.BuildVersion))
	_, _ = hash.Write([]byte(setting.BuildCommit))
	keys["version"] = fmt.Sprintf("%x", hash.Sum(nil))

	// Plugin configs
	plugins := []string{}
	for _, p := range hs.pluginStore.Plugins(c.Req.Context()) {
		plugins = append(plugins, fmt.Sprintf("%s@%s", p.Name, p.Info.Version))
	}
	keys["plugins"] = sortedHash(plugins, hash)

	// Feature flags
	enabled := []string{}
	for flag, set := range hs.Features.GetEnabled(c.Req.Context()) {
		if set {
			enabled = append(enabled, flag)
		}
	}
	keys["flags"] = sortedHash(enabled, hash)

	// Assets
	hash.Reset()
	dto, err := webassets.GetWebAssets(c.Req.Context(), hs.Cfg, hs.License)
	if err == nil && dto != nil {
		_, _ = hash.Write([]byte(dto.ContentDeliveryURL))
		_, _ = hash.Write([]byte(dto.Dark))
		_, _ = hash.Write([]byte(dto.Light))
		for _, f := range dto.JSFiles {
			_, _ = hash.Write([]byte(f.FilePath))
			_, _ = hash.Write([]byte(f.Integrity))
		}
	}
	keys["assets"] = fmt.Sprintf("%x", hash.Sum(nil))

	c.JSON(http.StatusOK, keys)
}

func sortedHash(vals []string, hash hash.Hash) string {
	hash.Reset()
	sort.Strings(vals)
	for _, v := range vals {
		_, _ = hash.Write([]byte(v))
	}
	return fmt.Sprintf("%x", hash.Sum(nil))
}

func (hs *HTTPServer) GetFrontendSettings(c *contextmodel.ReqContext) {
	settings, err := hs.getFrontendSettings(c)
	if err != nil {
		c.JsonApiErr(400, "Failed to get frontend settings", err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

// getFrontendSettings returns a json object with all the settings needed for front end initialisation.
//
//nolint:gocyclo
func (hs *HTTPServer) getFrontendSettings(c *contextmodel.ReqContext) (*dtos.FrontendSettingsDTO, error) {
	cfg := hs.Cfg.Get()
	c, span := hs.injectSpan(c, "api.getFrontendSettings")
	defer span.End()

	availablePlugins, err := hs.availablePlugins(c.Req.Context(), c.GetOrgID())
	if err != nil {
		return nil, err
	}

	apps := make(map[string]*plugins.AppDTO, 0)
	for _, ap := range availablePlugins[plugins.TypeApp] {
		apps[ap.Plugin.ID] = hs.newAppDTO(
			c.Req.Context(),
			ap.Plugin,
			ap.Settings,
		)
	}

	dataSources, err := hs.getFSDataSources(c, availablePlugins)
	if err != nil {
		return nil, err
	}

	defaultDS := "-- Grafana --"
	for n, ds := range dataSources {
		if ds.IsDefault {
			defaultDS = n
		}
	}

	panels := make(map[string]plugins.PanelDTO)
	for _, ap := range availablePlugins[plugins.TypePanel] {
		panel := ap.Plugin
		if panel.State == plugins.ReleaseStateAlpha && !cfg.PluginsEnableAlpha {
			continue
		}

		if panel.ID == "datagrid" && !hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagEnableDatagridEditing) {
			continue
		}

		panels[panel.ID] = plugins.PanelDTO{
			ID:              panel.ID,
			Name:            panel.Name,
			AliasIDs:        panel.AliasIDs,
			Info:            panel.Info,
			Module:          panel.Module,
			ModuleHash:      hs.pluginAssets.ModuleHash(c.Req.Context(), panel),
			BaseURL:         panel.BaseURL,
			SkipDataQuery:   panel.SkipDataQuery,
			HideFromList:    panel.HideFromList,
			ReleaseState:    string(panel.State),
			Signature:       string(panel.Signature),
			Sort:            getPanelSort(panel.ID),
			Angular:         panel.Angular,
			LoadingStrategy: hs.pluginAssets.LoadingStrategy(c.Req.Context(), panel),
			Translations:    panel.Translations,
		}
	}

	hideVersion := cfg.Anonymous.HideVersion && !c.IsSignedIn
	version := setting.BuildVersion
	commit := setting.BuildCommit
	commitShort := getShortCommitHash(setting.BuildCommit, 10)
	buildstamp := setting.BuildStamp
	versionString := fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, version, commitShort)

	if hideVersion {
		version = ""
		versionString = setting.ApplicationName
		commit = ""
		commitShort = ""
		buildstamp = 0
	}

	hasAccess := accesscontrol.HasAccess(hs.AccessControl, c)
	trustedTypesDefaultPolicyEnabled := (cfg.CSPEnabled && strings.Contains(cfg.CSPTemplate, "require-trusted-types-for")) || (cfg.CSPReportOnlyEnabled && strings.Contains(cfg.CSPReportOnlyTemplate, "require-trusted-types-for"))
	isCloudMigrationTarget := hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagOnPremToCloudMigrations) && cfg.CloudMigration.IsTarget
	featureToggles := hs.Features.GetEnabled(c.Req.Context())
	// this is needed for backwards compatibility with external plugins
	// we should remove this once we can be sure that no external plugins rely on this
	featureToggles["topnav"] = true

	frontendSettings := &dtos.FrontendSettingsDTO{
		DefaultDatasource:                   defaultDS,
		Datasources:                         dataSources,
		MinRefreshInterval:                  cfg.MinRefreshInterval,
		Panels:                              panels,
		Apps:                                apps,
		AppUrl:                              cfg.AppURL,
		AppSubUrl:                           cfg.AppSubURL,
		AllowOrgCreate:                      (cfg.AllowUserOrgCreate && c.IsSignedIn) || c.IsGrafanaAdmin,
		AuthProxyEnabled:                    cfg.AuthProxy.Enabled,
		LdapEnabled:                         cfg.LDAPAuthEnabled,
		JwtHeaderName:                       cfg.JWTAuth.HeaderName,
		JwtUrlLogin:                         cfg.JWTAuth.URLLogin,
		LiveEnabled:                         cfg.LiveMaxConnections != 0,
		LiveMessageSizeLimit:                cfg.LiveMessageSizeLimit,
		AutoAssignOrg:                       cfg.AutoAssignOrg,
		VerifyEmailEnabled:                  cfg.VerifyEmailEnabled,
		SigV4AuthEnabled:                    cfg.SigV4AuthEnabled,
		AzureAuthEnabled:                    cfg.AzureAuthEnabled,
		RbacEnabled:                         true,
		ExploreEnabled:                      cfg.ExploreEnabled,
		HelpEnabled:                         cfg.HelpEnabled,
		ProfileEnabled:                      cfg.ProfileEnabled,
		NewsFeedEnabled:                     cfg.NewsFeedEnabled,
		QueryHistoryEnabled:                 cfg.QueryHistoryEnabled,
		GoogleAnalyticsId:                   cfg.GoogleAnalyticsID,
		GoogleAnalytics4Id:                  cfg.GoogleAnalytics4ID,
		GoogleAnalytics4SendManualPageViews: cfg.GoogleAnalytics4SendManualPageViews,
		RudderstackWriteKey:                 cfg.RudderstackWriteKey,
		RudderstackDataPlaneUrl:             cfg.RudderstackDataPlaneURL,
		RudderstackSdkUrl:                   cfg.RudderstackSDKURL,
		RudderstackConfigUrl:                cfg.RudderstackConfigURL,
		RudderstackIntegrationsUrl:          cfg.RudderstackIntegrationsURL,
		AnalyticsConsoleReporting:           cfg.FrontendAnalyticsConsoleReporting,
		DashboardPerformanceMetrics:         cfg.DashboardPerformanceMetrics,
		PanelSeriesLimit:                    cfg.PanelSeriesLimit,
		FeedbackLinksEnabled:                cfg.FeedbackLinksEnabled,
		ApplicationInsightsConnectionString: cfg.ApplicationInsightsConnectionString,
		ApplicationInsightsEndpointUrl:      cfg.ApplicationInsightsEndpointUrl,
		DisableLoginForm:                    cfg.DisableLoginForm,
		DisableUserSignUp:                   !cfg.AllowUserSignUp,
		LoginHint:                           cfg.LoginHint,
		PasswordHint:                        cfg.PasswordHint,
		ExternalUserMngInfo:                 cfg.ExternalUserMngInfo,
		ExternalUserMngLinkUrl:              cfg.ExternalUserMngLinkUrl,
		ExternalUserMngLinkName:             cfg.ExternalUserMngLinkName,
		ExternalUserMngAnalytics:            cfg.ExternalUserMngAnalytics,
		ExternalUserMngAnalyticsParams:      cfg.ExternalUserMngAnalyticsParams,
		//nolint:staticcheck // ViewersCanEdit is deprecated but still used for backward compatibility
		ViewersCanEdit:                   cfg.ViewersCanEdit,
		DisableSanitizeHtml:              cfg.DisableSanitizeHtml,
		TrustedTypesDefaultPolicyEnabled: trustedTypesDefaultPolicyEnabled,
		CSPReportOnlyEnabled:             cfg.CSPReportOnlyEnabled,
		DateFormats:                      cfg.DateFormats,
		QuickRanges:                      cfg.QuickRanges,
		SecureSocksDSProxyEnabled:        cfg.SecureSocksDSProxy.Enabled && cfg.SecureSocksDSProxy.ShowUI,
		EnableFrontendSandboxForPlugins:  cfg.EnableFrontendSandboxForPlugins,
		PublicDashboardAccessToken:       c.PublicDashboardAccessToken,
		PublicDashboardsEnabled:          cfg.PublicDashboardsEnabled,
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
			HideVersion:   hideVersion,
			Version:       version,
			VersionString: versionString,
			Commit:        commit,
			CommitShort:   commitShort,
			Buildstamp:    buildstamp,
			Edition:       hs.License.Edition(),
			LatestVersion: hs.grafanaUpdateChecker.LatestVersion(),
			HasUpdate:     hs.grafanaUpdateChecker.UpdateAvailable(),
			Env:           cfg.Env,
		},

		LicenseInfo: dtos.FrontendSettingsLicenseInfoDTO{
			Expiry:          hs.License.Expiry(),
			StateInfo:       hs.License.StateInfo(),
			LicenseUrl:      hs.License.LicenseURL(hasAccess(licensing.PageAccess)),
			Edition:         hs.License.Edition(),
			EnabledFeatures: hs.License.EnabledFeatures(),
		},

		FeatureToggles:                   featureToggles,
		AnonymousEnabled:                 cfg.Anonymous.Enabled,
		AnonymousDeviceLimit:             cfg.Anonymous.DeviceLimit,
		RendererAvailable:                hs.RenderService.IsAvailable(c.Req.Context()),
		RendererVersion:                  hs.RenderService.Version(),
		RendererDefaultImageWidth:        cfg.RendererDefaultImageWidth,
		RendererDefaultImageHeight:       cfg.RendererDefaultImageHeight,
		RendererDefaultImageScale:        cfg.RendererDefaultImageScale,
		Http2Enabled:                     cfg.Protocol == setting.HTTP2Scheme,
		GrafanaJavascriptAgent:           cfg.GrafanaJavascriptAgent,
		PluginCatalogURL:                 cfg.PluginCatalogURL,
		PluginAdminEnabled:               cfg.PluginAdminEnabled,
		PluginAdminExternalManageEnabled: cfg.PluginAdminEnabled && cfg.PluginAdminExternalManageEnabled,
		PluginCatalogHiddenPlugins:       cfg.PluginCatalogHiddenPlugins,
		PluginCatalogManagedPlugins:      hs.managedPluginsService.ManagedPlugins(c.Req.Context()),
		PluginCatalogPreinstalledPlugins: append(cfg.PreinstallPluginsAsync, cfg.PreinstallPluginsSync...),
		ExpressionsEnabled:               cfg.ExpressionsEnabled,
		AwsAllowedAuthProviders:          cfg.AWSAllowedAuthProviders,
		AwsAssumeRoleEnabled:             cfg.AWSAssumeRoleEnabled,
		SupportBundlesEnabled:            isSupportBundlesEnabled(hs),

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
			Enabled: cfg.SectionWithEnvOverrides("caching").Key("enabled").MustBool(true),
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

		UnifiedAlerting: dtos.FrontendSettingsUnifiedAlertingDTO{
			MinInterval: cfg.UnifiedAlerting.MinInterval.String(),
		},

		Oauth:                   hs.getEnabledOAuthProviders(),
		SamlEnabled:             hs.samlEnabled(),
		SamlName:                hs.samlName(),
		TokenExpirationDayLimit: cfg.SATokenExpirationDayLimit,

		SnapshotEnabled: cfg.SnapshotEnabled,

		SqlConnectionLimits: dtos.FrontendSettingsSqlConnectionLimitsDTO{
			MaxOpenConns:    cfg.SqlDatasourceMaxOpenConnsDefault,
			MaxIdleConns:    cfg.SqlDatasourceMaxIdleConnsDefault,
			ConnMaxLifetime: cfg.SqlDatasourceMaxConnLifetimeDefault,
		},
	}

	if cfg.UnifiedAlerting.StateHistory.Enabled {
		frontendSettings.UnifiedAlerting.AlertStateHistoryBackend = cfg.UnifiedAlerting.StateHistory.Backend
		frontendSettings.UnifiedAlerting.AlertStateHistoryPrimary = cfg.UnifiedAlerting.StateHistory.MultiPrimary
	}

	frontendSettings.UnifiedAlerting.RecordingRulesEnabled = cfg.UnifiedAlerting.RecordingRules.Enabled
	frontendSettings.UnifiedAlerting.DefaultRecordingRulesTargetDatasourceUID = cfg.UnifiedAlerting.RecordingRules.DefaultDatasourceUID

	if cfg.UnifiedAlerting.Enabled != nil {
		frontendSettings.UnifiedAlertingEnabled = *cfg.UnifiedAlerting.Enabled
	}

	// It returns false if the provider is not enabled or the skip org role sync is false.
	parseSkipOrgRoleSyncEnabled := func(info *social.OAuthInfo) bool {
		if info == nil {
			return false
		}
		return info.SkipOrgRoleSync
	}

	oauthProviders := hs.SocialService.GetOAuthInfoProviders()
	frontendSettings.Auth = dtos.FrontendSettingsAuthDTO{
		AuthProxyEnableLoginToken:     cfg.AuthProxy.EnableLoginToken,
		SAMLSkipOrgRoleSync:           cfg.SAMLSkipOrgRoleSync,
		LDAPSkipOrgRoleSync:           cfg.LDAPSkipOrgRoleSync,
		JWTAuthSkipOrgRoleSync:        cfg.JWTAuth.SkipOrgRoleSync,
		GoogleSkipOrgRoleSync:         parseSkipOrgRoleSyncEnabled(oauthProviders[social.GoogleProviderName]),
		GrafanaComSkipOrgRoleSync:     parseSkipOrgRoleSyncEnabled(oauthProviders[social.GrafanaComProviderName]),
		GenericOAuthSkipOrgRoleSync:   parseSkipOrgRoleSyncEnabled(oauthProviders[social.GenericOAuthProviderName]),
		AzureADSkipOrgRoleSync:        parseSkipOrgRoleSyncEnabled(oauthProviders[social.AzureADProviderName]),
		GithubSkipOrgRoleSync:         parseSkipOrgRoleSyncEnabled(oauthProviders[social.GitHubProviderName]),
		GitLabSkipOrgRoleSync:         parseSkipOrgRoleSyncEnabled(oauthProviders[social.GitlabProviderName]),
		OktaSkipOrgRoleSync:           parseSkipOrgRoleSyncEnabled(oauthProviders[social.OktaProviderName]),
		DisableLogin:                  cfg.DisableLogin,
		BasicAuthStrongPasswordPolicy: cfg.BasicAuthStrongPasswordPolicy,
		DisableSignoutMenu:            cfg.DisableSignoutMenu,
	}

	if cfg.PasswordlessMagicLinkAuth.Enabled && hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagPasswordlessMagicLinkAuthentication) {
		hasEnabledProviders := hs.samlEnabled() || hs.authnService.IsClientEnabled(authn.ClientLDAP)

		if !hasEnabledProviders {
			oauthInfos := hs.SocialService.GetOAuthInfoProviders()
			for _, provider := range oauthInfos {
				if provider.Enabled {
					hasEnabledProviders = true
					break
				}
			}
		}

		if !hasEnabledProviders {
			frontendSettings.Auth.PasswordlessEnabled = true
		}
	}

	if hs.pluginsCDNService != nil && hs.pluginsCDNService.IsEnabled() {
		cdnBaseURL, err := hs.pluginsCDNService.BaseURL()
		if err != nil {
			return nil, fmt.Errorf("plugins cdn base url: %w", err)
		}
		frontendSettings.PluginsCDNBaseURL = cdnBaseURL
	}

	if cfg.GeomapDefaultBaseLayerConfig != nil {
		frontendSettings.GeomapDefaultBaseLayerConfig = &cfg.GeomapDefaultBaseLayerConfig
	}

	if !cfg.GeomapEnableCustomBaseLayers {
		frontendSettings.GeomapDisableCustomBaseLayer = true
	}

	// Set the kubernetes namespace
	frontendSettings.Namespace = hs.namespacer(c.OrgID)

	// experimental scope features
	if hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagScopeFilters) {
		frontendSettings.ListScopesEndpoint = cfg.ScopesListScopesURL
		frontendSettings.ListDashboardScopesEndpoint = cfg.ScopesListDashboardsURL
	}

	return frontendSettings, nil
}

func isSupportBundlesEnabled(hs *HTTPServer) bool {
	cfg := hs.Cfg.Get()
	return cfg.SectionWithEnvOverrides("support_bundles").Key("enabled").MustBool(true)
}

func getShortCommitHash(commitHash string, maxLength int) string {
	if len(commitHash) > maxLength {
		return commitHash[:maxLength]
	}
	return commitHash
}

func (hs *HTTPServer) getFSDataSources(c *contextmodel.ReqContext, availablePlugins AvailablePlugins) (map[string]plugins.DataSourceDTO, error) {
	cfg := hs.Cfg.Get()
	c, span := hs.injectSpan(c, "api.getFSDataSources")
	defer span.End()

	orgDataSources := make([]*datasources.DataSource, 0)
	if c.GetOrgID() != 0 {
		query := datasources.GetDataSourcesQuery{OrgID: c.GetOrgID(), DataSourceLimit: cfg.DataSourceLimit}
		dataSources, err := hs.DataSourcesService.GetDataSources(c.Req.Context(), &query)
		if err != nil {
			return nil, err
		}

		if c.IsPublicDashboardView() {
			// If RBAC is enabled, it will filter out all datasources for a public user, so we need to skip it
			orgDataSources = dataSources
		} else {
			filtered, err := hs.dsGuardian.New(c.SignedInUser.OrgID, c.SignedInUser).FilterDatasourcesByReadPermissions(dataSources)
			if err != nil {
				return nil, err
			}
			orgDataSources = filtered
		}
	}

	dataSources := make(map[string]plugins.DataSourceDTO)

	for _, ds := range orgDataSources {
		url := ds.URL

		if ds.Access == datasources.DS_ACCESS_PROXY {
			url = "/api/datasources/proxy/uid/" + ds.UID
		}

		dsDTO := plugins.DataSourceDTO{
			ID:         ds.ID,
			UID:        ds.UID,
			Type:       ds.Type,
			Name:       ds.Name,
			URL:        url,
			IsDefault:  ds.IsDefault,
			Access:     string(ds.Access),
			ReadOnly:   ds.ReadOnly,
			APIVersion: ds.APIVersion,
		}

		ap, exists := availablePlugins.Get(plugins.TypeDataSource, ds.Type)
		if !exists {
			c.Logger.Error("Could not find plugin definition for data source", "datasource_type", ds.Type)
			continue
		}
		plugin := ap.Plugin
		dsDTO.Type = plugin.ID
		dsDTO.Preload = plugin.Preload
		dsDTO.Module = plugin.Module
		dsDTO.PluginMeta = &plugins.PluginMetaDTO{
			JSONData:                  plugin.JSONData,
			Signature:                 plugin.Signature,
			Module:                    plugin.Module,
			ModuleHash:                hs.pluginAssets.ModuleHash(c.Req.Context(), plugin),
			BaseURL:                   plugin.BaseURL,
			Angular:                   plugin.Angular,
			MultiValueFilterOperators: plugin.MultiValueFilterOperators,
			LoadingStrategy:           hs.pluginAssets.LoadingStrategy(c.Req.Context(), plugin),
			Translations:              plugin.Translations,
		}

		if ds.JsonData == nil {
			dsDTO.JSONData = make(map[string]any)
		} else {
			dsDTO.JSONData = ds.JsonData.MustMap()
		}

		if ds.Access == datasources.DS_ACCESS_DIRECT {
			if ds.BasicAuth {
				password, err := hs.DataSourcesService.DecryptedBasicAuthPassword(c.Req.Context(), ds)
				if err != nil {
					return nil, err
				}

				dsDTO.BasicAuth = util.GetBasicAuthHeader(
					ds.BasicAuthUser,
					password,
				)
			}
			if ds.WithCredentials {
				dsDTO.WithCredentials = ds.WithCredentials
			}

			if ds.Type == datasources.DS_INFLUXDB_08 {
				password, err := hs.DataSourcesService.DecryptedPassword(c.Req.Context(), ds)
				if err != nil {
					return nil, err
				}

				dsDTO.Username = ds.User
				dsDTO.Password = password
				dsDTO.URL = url + "/db/" + ds.Database
			}

			if ds.Type == datasources.DS_INFLUXDB {
				password, err := hs.DataSourcesService.DecryptedPassword(c.Req.Context(), ds)
				if err != nil {
					return nil, err
				}

				dsDTO.Username = ds.User
				dsDTO.Password = password
				dsDTO.URL = url
			}
		}

		// Update `jsonData.database` for outdated provisioned SQL datasources created WITHOUT the `jsonData` object in their configuration.
		// In these cases, the `Database` value is defined (if at all) on the root level of the provisioning config object.
		// This is done for easier warning/error checking on the front end.
		if (ds.Type == datasources.DS_MSSQL) || (ds.Type == datasources.DS_MYSQL) || (ds.Type == datasources.DS_POSTGRES) {
			// Only update if the value isn't already assigned.
			if dsDTO.JSONData["database"] == nil || dsDTO.JSONData["database"] == "" {
				dsDTO.JSONData["database"] = ds.Database
			}
		}

		if (ds.Type == datasources.DS_INFLUXDB) || (ds.Type == datasources.DS_ES) {
			dsDTO.Database = ds.Database
		}

		if ds.Type == datasources.DS_PROMETHEUS || ds.Type == datasources.DS_AMAZON_PROMETHEUS || ds.Type == datasources.DS_AZURE_PROMETHEUS {
			// add unproxied server URL for link to Prometheus web UI
			ds.JsonData.Set("directUrl", ds.URL)
		}

		dataSources[ds.Name] = dsDTO
	}

	// add data sources that are built in (meaning they are not added via data sources page, nor have any entry in
	// the datasource table)
	for _, ds := range hs.pluginStore.Plugins(c.Req.Context(), plugins.TypeDataSource) {
		if ds.BuiltIn {
			dto := plugins.DataSourceDTO{
				Type:     string(ds.Type),
				Name:     ds.Name,
				JSONData: make(map[string]any),
				PluginMeta: &plugins.PluginMetaDTO{
					JSONData:  ds.JSONData,
					Signature: ds.Signature,
					Module:    ds.Module,
					// ModuleHash: hs.pluginAssets.ModuleHash(c.Req.Context(), ds),
					BaseURL:      ds.BaseURL,
					Angular:      ds.Angular,
					Translations: ds.Translations,
				},
			}
			if ds.Name == grafanads.DatasourceName {
				dto.ID = grafanads.DatasourceID
				dto.UID = grafanads.DatasourceUID
			}
			dataSources[ds.Name] = dto
		}
	}

	return dataSources, nil
}

func (hs *HTTPServer) newAppDTO(ctx context.Context, plugin pluginstore.Plugin, settings pluginsettings.InfoDTO) *plugins.AppDTO {
	app := &plugins.AppDTO{
		ID:              plugin.ID,
		Version:         plugin.Info.Version,
		Path:            plugin.Module,
		Preload:         false,
		Angular:         plugin.Angular,
		LoadingStrategy: hs.pluginAssets.LoadingStrategy(ctx, plugin),
		Extensions:      plugin.Extensions,
		Dependencies:    plugin.Dependencies,
		ModuleHash:      hs.pluginAssets.ModuleHash(ctx, plugin),
		Translations:    plugin.Translations,
	}

	if settings.Enabled {
		app.Preload = plugin.Preload
	}

	return app
}

func getPanelSort(id string) int {
	sort := 100
	switch id {
	case "timeseries":
		sort = 1
	case "barchart":
		sort = 2
	case "stat":
		sort = 3
	case "gauge":
		sort = 4
	case "bargauge":
		sort = 5
	case "table":
		sort = 6
	case "singlestat":
		sort = 7
	case "piechart":
		sort = 8
	case "state-timeline":
		sort = 9
	case "heatmap":
		sort = 10
	case "status-history":
		sort = 11
	case "histogram":
		sort = 12
	case "graph":
		sort = 13
	case "text":
		sort = 14
	case "alertlist":
		sort = 15
	case "dashlist":
		sort = 16
	case "news":
		sort = 17
	}
	return sort
}

type availablePluginDTO struct {
	Plugin   pluginstore.Plugin
	Settings pluginsettings.InfoDTO
}

// AvailablePlugins represents a mapping from plugin types (panel, data source, etc.) to plugin IDs to plugins
// For example ["panel"] -> ["piechart"] -> {pie chart plugin DTO}
type AvailablePlugins map[plugins.Type]map[string]*availablePluginDTO

func (ap AvailablePlugins) Get(pluginType plugins.Type, pluginID string) (*availablePluginDTO, bool) {
	p, exists := ap[pluginType][pluginID]
	if exists {
		return p, true
	}
	for _, p = range ap[pluginType] {
		if p.Plugin.ID == pluginID || slices.Contains(p.Plugin.AliasIDs, pluginID) {
			return p, true
		}
	}
	return nil, false
}

func (hs *HTTPServer) availablePlugins(ctx context.Context, orgID int64) (AvailablePlugins, error) {
	ctx, span := hs.tracer.Start(ctx, "api.availablePlugins")
	defer span.End()

	ap := make(AvailablePlugins)

	pluginSettingMap, err := hs.pluginSettings(ctx, orgID)
	if err != nil {
		return ap, err
	}

	apps := make(map[string]*availablePluginDTO)
	for _, app := range hs.pluginStore.Plugins(ctx, plugins.TypeApp) {
		if s, exists := pluginSettingMap[app.ID]; exists {
			app.Pinned = s.Pinned
			apps[app.ID] = &availablePluginDTO{
				Plugin:   app,
				Settings: *s,
			}
		}
	}
	ap[plugins.TypeApp] = apps

	dataSources := make(map[string]*availablePluginDTO)
	for _, ds := range hs.pluginStore.Plugins(ctx, plugins.TypeDataSource) {
		if s, exists := pluginSettingMap[ds.ID]; exists {
			dataSources[ds.ID] = &availablePluginDTO{
				Plugin:   ds,
				Settings: *s,
			}
		}
	}
	ap[plugins.TypeDataSource] = dataSources

	panels := make(map[string]*availablePluginDTO)
	for _, p := range hs.pluginStore.Plugins(ctx, plugins.TypePanel) {
		if s, exists := pluginSettingMap[p.ID]; exists {
			panels[p.ID] = &availablePluginDTO{
				Plugin:   p,
				Settings: *s,
			}
		}
	}
	ap[plugins.TypePanel] = panels

	return ap, nil
}

func (hs *HTTPServer) pluginSettings(ctx context.Context, orgID int64) (map[string]*pluginsettings.InfoDTO, error) {
	ctx, span := hs.tracer.Start(ctx, "api.pluginSettings")
	defer span.End()

	pluginSettings := make(map[string]*pluginsettings.InfoDTO)

	// fill settings from database
	if pss, err := hs.PluginSettings.GetPluginSettings(ctx, &pluginsettings.GetArgs{OrgID: orgID}); err != nil {
		return nil, err
	} else {
		for _, ps := range pss {
			pluginSettings[ps.PluginID] = ps
		}
	}

	// fill settings from app plugins
	for _, plugin := range hs.pluginStore.Plugins(ctx, plugins.TypeApp) {
		// ignore settings that already exist
		if _, exists := pluginSettings[plugin.ID]; exists {
			continue
		}

		// add new setting which is enabled depending on if AutoEnabled: true
		pluginSetting := &pluginsettings.InfoDTO{
			PluginID:      plugin.ID,
			OrgID:         orgID,
			Enabled:       plugin.AutoEnabled,
			Pinned:        plugin.AutoEnabled,
			AutoEnabled:   plugin.AutoEnabled,
			PluginVersion: plugin.Info.Version,
		}

		pluginSettings[plugin.ID] = pluginSetting
	}

	// fill settings from all remaining plugins (including potential app child plugins)
	for _, plugin := range hs.pluginStore.Plugins(ctx) {
		// ignore settings that already exist
		if _, exists := pluginSettings[plugin.ID]; exists {
			continue
		}

		// add new setting which is enabled by default
		pluginSetting := &pluginsettings.InfoDTO{
			PluginID:      plugin.ID,
			OrgID:         orgID,
			Enabled:       true,
			Pinned:        false,
			PluginVersion: plugin.Info.Version,
		}

		// if plugin is included in an app, check app settings
		if plugin.IncludedInAppID != "" {
			// app child plugins are disabled unless app is enabled
			pluginSetting.Enabled = false
			if p, exists := pluginSettings[plugin.IncludedInAppID]; exists {
				pluginSetting.Enabled = p.Enabled
			}
		}
		pluginSettings[plugin.ID] = pluginSetting
	}

	return pluginSettings, nil
}

func (hs *HTTPServer) getEnabledOAuthProviders() map[string]any {
	providers := make(map[string]any)
	for key, oauth := range hs.SocialService.GetOAuthInfoProviders() {
		providers[key] = map[string]string{
			"name": oauth.Name,
			"icon": oauth.Icon,
		}
	}
	return providers
}

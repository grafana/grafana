package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) GetFrontendSettings(c *contextmodel.ReqContext) {
	settings, err := hs.getFrontendSettings(c)
	if err != nil {
		c.JsonApiErr(400, "Failed to get frontend settings", err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

// getFrontendSettings returns a json object with all the settings needed for front end initialisation.
func (hs *HTTPServer) getFrontendSettings(c *contextmodel.ReqContext) (*dtos.FrontendSettingsDTO, error) {
	availablePlugins, err := hs.availablePlugins(c.Req.Context(), c.OrgID)
	if err != nil {
		return nil, err
	}

	apps := make(map[string]*plugins.AppDTO, 0)
	for _, ap := range availablePlugins[plugins.App] {
		apps[ap.Plugin.ID] = newAppDTO(
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
	for _, ap := range availablePlugins[plugins.Panel] {
		panel := ap.Plugin
		if panel.State == plugins.AlphaRelease && !hs.Cfg.PluginsEnableAlpha {
			continue
		}

		panels[panel.ID] = plugins.PanelDTO{
			ID:            panel.ID,
			Name:          panel.Name,
			Info:          panel.Info,
			Module:        panel.Module,
			BaseURL:       panel.BaseURL,
			SkipDataQuery: panel.SkipDataQuery,
			HideFromList:  panel.HideFromList,
			ReleaseState:  string(panel.State),
			Signature:     string(panel.Signature),
			Sort:          getPanelSort(panel.ID),
		}
	}

	hideVersion := hs.Cfg.AnonymousHideVersion && !c.IsSignedIn
	version := setting.BuildVersion
	commit := setting.BuildCommit
	buildstamp := setting.BuildStamp

	if hideVersion {
		version = ""
		commit = ""
		buildstamp = 0
	}

	hasAccess := accesscontrol.HasAccess(hs.AccessControl, c)
	secretsManagerPluginEnabled := kvstore.EvaluateRemoteSecretsPlugin(c.Req.Context(), hs.secretsPluginManager, hs.Cfg) == nil

	frontendSettings := &dtos.FrontendSettingsDTO{
		DefaultDatasource:                   defaultDS,
		Datasources:                         dataSources,
		MinRefreshInterval:                  setting.MinRefreshInterval,
		Panels:                              panels,
		Apps:                                apps,
		AppUrl:                              hs.Cfg.AppURL,
		AppSubUrl:                           hs.Cfg.AppSubURL,
		AllowOrgCreate:                      (setting.AllowUserOrgCreate && c.IsSignedIn) || c.IsGrafanaAdmin,
		AuthProxyEnabled:                    hs.Cfg.AuthProxyEnabled,
		LdapEnabled:                         hs.Cfg.LDAPAuthEnabled,
		JwtHeaderName:                       hs.Cfg.JWTAuthHeaderName,
		JwtUrlLogin:                         hs.Cfg.JWTAuthURLLogin,
		AlertingErrorOrTimeout:              setting.AlertingErrorOrTimeout,
		AlertingNoDataOrNullValues:          setting.AlertingNoDataOrNullValues,
		AlertingMinInterval:                 setting.AlertingMinInterval,
		LiveEnabled:                         hs.Cfg.LiveMaxConnections != 0,
		AutoAssignOrg:                       hs.Cfg.AutoAssignOrg,
		VerifyEmailEnabled:                  setting.VerifyEmailEnabled,
		SigV4AuthEnabled:                    setting.SigV4AuthEnabled,
		AzureAuthEnabled:                    setting.AzureAuthEnabled,
		RbacEnabled:                         hs.Cfg.RBACEnabled,
		ExploreEnabled:                      setting.ExploreEnabled,
		HelpEnabled:                         setting.HelpEnabled,
		ProfileEnabled:                      setting.ProfileEnabled,
		QueryHistoryEnabled:                 hs.Cfg.QueryHistoryEnabled,
		GoogleAnalyticsId:                   hs.Cfg.GoogleAnalyticsID,
		GoogleAnalytics4Id:                  hs.Cfg.GoogleAnalytics4ID,
		GoogleAnalytics4SendManualPageViews: hs.Cfg.GoogleAnalytics4SendManualPageViews,
		RudderstackWriteKey:                 hs.Cfg.RudderstackWriteKey,
		RudderstackDataPlaneUrl:             hs.Cfg.RudderstackDataPlaneURL,
		RudderstackSdkUrl:                   hs.Cfg.RudderstackSDKURL,
		RudderstackConfigUrl:                hs.Cfg.RudderstackConfigURL,
		FeedbackLinksEnabled:                hs.Cfg.FeedbackLinksEnabled,
		ApplicationInsightsConnectionString: hs.Cfg.ApplicationInsightsConnectionString,
		ApplicationInsightsEndpointUrl:      hs.Cfg.ApplicationInsightsEndpointUrl,
		DisableLoginForm:                    hs.Cfg.DisableLoginForm,
		DisableUserSignUp:                   !setting.AllowUserSignUp,
		LoginHint:                           setting.LoginHint,
		PasswordHint:                        setting.PasswordHint,
		ExternalUserMngInfo:                 setting.ExternalUserMngInfo,
		ExternalUserMngLinkUrl:              setting.ExternalUserMngLinkUrl,
		ExternalUserMngLinkName:             setting.ExternalUserMngLinkName,
		ViewersCanEdit:                      hs.Cfg.ViewersCanEdit,
		AngularSupportEnabled:               hs.Cfg.AngularSupportEnabled,
		EditorsCanAdmin:                     hs.Cfg.EditorsCanAdmin,
		DisableSanitizeHtml:                 hs.Cfg.DisableSanitizeHtml,
		DateFormats:                         hs.Cfg.DateFormats,

		Auth: dtos.FrontendSettingsAuthDTO{
			OAuthSkipOrgRoleUpdateSync:  hs.Cfg.OAuthSkipOrgRoleUpdateSync,
			SAMLSkipOrgRoleSync:         hs.Cfg.SAMLSkipOrgRoleSync,
			LDAPSkipOrgRoleSync:         hs.Cfg.LDAPSkipOrgRoleSync,
			GoogleSkipOrgRoleSync:       hs.Cfg.GoogleSkipOrgRoleSync,
			JWTAuthSkipOrgRoleSync:      hs.Cfg.JWTAuthSkipOrgRoleSync,
			GrafanaComSkipOrgRoleSync:   hs.Cfg.GrafanaComSkipOrgRoleSync,
			GenericOAuthSkipOrgRoleSync: hs.Cfg.GenericOAuthSkipOrgRoleSync,
			AzureADSkipOrgRoleSync:      hs.Cfg.AzureADSkipOrgRoleSync,
			GithubSkipOrgRoleSync:       hs.Cfg.GitHubSkipOrgRoleSync,
			GitLabSkipOrgRoleSync:       hs.Cfg.GitLabSkipOrgRoleSync,
			OktaSkipOrgRoleSync:         hs.Cfg.OktaSkipOrgRoleSync,
			DisableSyncLock:             hs.Cfg.DisableSyncLock,
		},

		BuildInfo: dtos.FrontendSettingsBuildInfoDTO{
			HideVersion:   hideVersion,
			Version:       version,
			Commit:        commit,
			Buildstamp:    buildstamp,
			Edition:       hs.License.Edition(),
			LatestVersion: hs.grafanaUpdateChecker.LatestVersion(),
			HasUpdate:     hs.grafanaUpdateChecker.UpdateAvailable(),
			Env:           setting.Env,
		},

		LicenseInfo: dtos.FrontendSettingsLicenseInfoDTO{
			Expiry:          hs.License.Expiry(),
			StateInfo:       hs.License.StateInfo(),
			LicenseUrl:      hs.License.LicenseURL(hasAccess(accesscontrol.ReqGrafanaAdmin, licensing.PageAccess)),
			Edition:         hs.License.Edition(),
			EnabledFeatures: hs.License.EnabledFeatures(),
		},

		FeatureToggles:                   hs.Features.GetEnabled(c.Req.Context()),
		AnonymousEnabled:                 hs.Cfg.AnonymousEnabled,
		RendererAvailable:                hs.RenderService.IsAvailable(c.Req.Context()),
		RendererVersion:                  hs.RenderService.Version(),
		SecretsManagerPluginEnabled:      secretsManagerPluginEnabled,
		Http2Enabled:                     hs.Cfg.Protocol == setting.HTTP2Scheme,
		Sentry:                           hs.Cfg.Sentry,
		GrafanaJavascriptAgent:           hs.Cfg.GrafanaJavascriptAgent,
		PluginCatalogURL:                 hs.Cfg.PluginCatalogURL,
		PluginAdminEnabled:               hs.Cfg.PluginAdminEnabled,
		PluginAdminExternalManageEnabled: hs.Cfg.PluginAdminEnabled && hs.Cfg.PluginAdminExternalManageEnabled,
		PluginCatalogHiddenPlugins:       hs.Cfg.PluginCatalogHiddenPlugins,
		ExpressionsEnabled:               hs.Cfg.ExpressionsEnabled,
		AwsAllowedAuthProviders:          hs.Cfg.AWSAllowedAuthProviders,
		AwsAssumeRoleEnabled:             hs.Cfg.AWSAssumeRoleEnabled,
		SupportBundlesEnabled:            isSupportBundlesEnabled(hs),

		Azure: dtos.FrontendSettingsAzureDTO{
			Cloud:                  hs.Cfg.Azure.Cloud,
			ManagedIdentityEnabled: hs.Cfg.Azure.ManagedIdentityEnabled,
		},

		Caching: dtos.FrontendSettingsCachingDTO{
			Enabled: hs.Cfg.SectionWithEnvOverrides("caching").Key("enabled").MustBool(true),
		},
		RecordedQueries: dtos.FrontendSettingsRecordedQueriesDTO{
			Enabled: hs.Cfg.SectionWithEnvOverrides("recorded_queries").Key("enabled").MustBool(true),
		},
		Reporting: dtos.FrontendSettingsReportingDTO{
			Enabled: hs.Cfg.SectionWithEnvOverrides("reporting").Key("enabled").MustBool(true),
		},

		UnifiedAlerting: dtos.FrontendSettingsUnifiedAlertingDTO{
			MinInterval: hs.Cfg.UnifiedAlerting.MinInterval.String(),
		},

		Oauth:                   hs.getEnabledOAuthProviders(),
		SamlEnabled:             hs.samlEnabled(),
		SamlName:                hs.samlName(),
		TokenExpirationDayLimit: hs.Cfg.SATokenExpirationDayLimit,

		SnapshotEnabled: hs.Cfg.SnapshotEnabled,
	}

	if hs.Cfg.UnifiedAlerting.StateHistory.Enabled {
		frontendSettings.UnifiedAlerting.AlertStateHistoryBackend = hs.Cfg.UnifiedAlerting.StateHistory.Backend
	}

	if hs.Cfg.UnifiedAlerting.Enabled != nil {
		frontendSettings.UnifiedAlertingEnabled = *hs.Cfg.UnifiedAlerting.Enabled
	}

	if setting.AlertingEnabled != nil {
		frontendSettings.AlertingEnabled = *setting.AlertingEnabled
	}

	if hs.pluginsCDNService != nil && hs.pluginsCDNService.IsEnabled() {
		cdnBaseURL, err := hs.pluginsCDNService.BaseURL()
		if err != nil {
			return nil, fmt.Errorf("plugins cdn base url: %w", err)
		}
		frontendSettings.PluginsCDNBaseURL = cdnBaseURL
	}

	if hs.ThumbService != nil {
		frontendSettings.DashboardPreviews = hs.ThumbService.GetDashboardPreviewsSetupSettings(c)
	}

	if hs.Cfg.GeomapDefaultBaseLayerConfig != nil {
		frontendSettings.GeomapDefaultBaseLayerConfig = &hs.Cfg.GeomapDefaultBaseLayerConfig
	}

	if !hs.Cfg.GeomapEnableCustomBaseLayers {
		frontendSettings.GeomapDisableCustomBaseLayer = true
	}

	return frontendSettings, nil
}

func isSupportBundlesEnabled(hs *HTTPServer) bool {
	return hs.Cfg.SectionWithEnvOverrides("support_bundles").Key("enabled").MustBool(true)
}

func (hs *HTTPServer) getFSDataSources(c *contextmodel.ReqContext, availablePlugins AvailablePlugins) (map[string]plugins.DataSourceDTO, error) {
	orgDataSources := make([]*datasources.DataSource, 0)
	if c.OrgID != 0 {
		query := datasources.GetDataSourcesQuery{OrgID: c.OrgID, DataSourceLimit: hs.Cfg.DataSourceLimit}
		dataSources, err := hs.DataSourcesService.GetDataSources(c.Req.Context(), &query)
		if err != nil {
			return nil, err
		}

		if c.IsPublicDashboardView {
			// If RBAC is enabled, it will filter out all datasources for a public user, so we need to skip it
			orgDataSources = dataSources
		} else {
			filtered, err := hs.filterDatasourcesByQueryPermission(c.Req.Context(), c.SignedInUser, dataSources)
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
			ID:        ds.ID,
			UID:       ds.UID,
			Type:      ds.Type,
			Name:      ds.Name,
			URL:       url,
			IsDefault: ds.IsDefault,
			Access:    string(ds.Access),
			ReadOnly:  ds.ReadOnly,
		}

		ap, exists := availablePlugins.Get(plugins.DataSource, ds.Type)
		if !exists {
			c.Logger.Error("Could not find plugin definition for data source", "datasource_type", ds.Type)
			continue
		}
		plugin := ap.Plugin
		dsDTO.Preload = plugin.Preload
		dsDTO.Module = plugin.Module
		dsDTO.PluginMeta = &plugins.PluginMetaDTO{
			JSONData:  plugin.JSONData,
			Signature: plugin.Signature,
			Module:    plugin.Module,
			BaseURL:   plugin.BaseURL,
		}

		if ds.JsonData == nil {
			dsDTO.JSONData = make(map[string]interface{})
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

		if (ds.Type == datasources.DS_INFLUXDB) || (ds.Type == datasources.DS_ES) {
			dsDTO.Database = ds.Database
		}

		if ds.Type == datasources.DS_PROMETHEUS {
			// add unproxied server URL for link to Prometheus web UI
			ds.JsonData.Set("directUrl", ds.URL)
		}

		dataSources[ds.Name] = dsDTO
	}

	// add data sources that are built in (meaning they are not added via data sources page, nor have any entry in
	// the datasource table)
	for _, ds := range hs.pluginStore.Plugins(c.Req.Context(), plugins.DataSource) {
		if ds.BuiltIn {
			dto := plugins.DataSourceDTO{
				Type:     string(ds.Type),
				Name:     ds.Name,
				JSONData: make(map[string]interface{}),
				PluginMeta: &plugins.PluginMetaDTO{
					JSONData:  ds.JSONData,
					Signature: ds.Signature,
					Module:    ds.Module,
					BaseURL:   ds.BaseURL,
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

func newAppDTO(plugin plugins.PluginDTO, settings pluginsettings.InfoDTO) *plugins.AppDTO {
	app := &plugins.AppDTO{
		ID:      plugin.ID,
		Version: plugin.Info.Version,
		Path:    plugin.Module,
		Preload: false,
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
	Plugin   plugins.PluginDTO
	Settings pluginsettings.InfoDTO
}

// AvailablePlugins represents a mapping from plugin types (panel, data source, etc.) to plugin IDs to plugins
// For example ["panel"] -> ["piechart"] -> {pie chart plugin DTO}
type AvailablePlugins map[plugins.Type]map[string]*availablePluginDTO

func (ap AvailablePlugins) Get(pluginType plugins.Type, pluginID string) (*availablePluginDTO, bool) {
	if _, exists := ap[pluginType][pluginID]; exists {
		return ap[pluginType][pluginID], true
	}

	return nil, false
}

func (hs *HTTPServer) availablePlugins(ctx context.Context, orgID int64) (AvailablePlugins, error) {
	ap := make(AvailablePlugins)

	pluginSettingMap, err := hs.pluginSettings(ctx, orgID)
	if err != nil {
		return ap, err
	}

	apps := make(map[string]*availablePluginDTO)
	for _, app := range hs.pluginStore.Plugins(ctx, plugins.App) {
		if s, exists := pluginSettingMap[app.ID]; exists {
			app.Pinned = s.Pinned
			apps[app.ID] = &availablePluginDTO{
				Plugin:   app,
				Settings: *s,
			}
		}
	}
	ap[plugins.App] = apps

	dataSources := make(map[string]*availablePluginDTO)
	for _, ds := range hs.pluginStore.Plugins(ctx, plugins.DataSource) {
		if s, exists := pluginSettingMap[ds.ID]; exists {
			dataSources[ds.ID] = &availablePluginDTO{
				Plugin:   ds,
				Settings: *s,
			}
		}
	}
	ap[plugins.DataSource] = dataSources

	panels := make(map[string]*availablePluginDTO)
	for _, p := range hs.pluginStore.Plugins(ctx, plugins.Panel) {
		if s, exists := pluginSettingMap[p.ID]; exists {
			panels[p.ID] = &availablePluginDTO{
				Plugin:   p,
				Settings: *s,
			}
		}
	}
	ap[plugins.Panel] = panels

	return ap, nil
}

func (hs *HTTPServer) pluginSettings(ctx context.Context, orgID int64) (map[string]*pluginsettings.InfoDTO, error) {
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
	for _, plugin := range hs.pluginStore.Plugins(ctx, plugins.App) {
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

func (hs *HTTPServer) getEnabledOAuthProviders() map[string]interface{} {
	providers := make(map[string]interface{})
	for key, oauth := range hs.SocialService.GetOAuthInfoProviders() {
		providers[key] = map[string]string{
			"name": oauth.Name,
			"icon": oauth.Icon,
		}
	}
	return providers
}

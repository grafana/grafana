package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) GetFrontendSettings(c *contextmodel.ReqContext) {
	settings, err := hs.getFrontendSettingsMap(c)
	if err != nil {
		c.JsonApiErr(400, "Failed to get frontend settings", err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

// getFrontendSettingsMap returns a json object with all the settings needed for front end initialisation.
func (hs *HTTPServer) getFrontendSettingsMap(c *contextmodel.ReqContext) (map[string]interface{}, error) {
	enabledPlugins, err := hs.enabledPlugins(c.Req.Context(), c.OrgID)
	if err != nil {
		return nil, err
	}

	pluginsToPreload := make([]*plugins.PreloadPlugin, 0)
	for _, app := range enabledPlugins[plugins.App] {
		if app.Preload {
			pluginsToPreload = append(pluginsToPreload, &plugins.PreloadPlugin{
				Path:    app.Module,
				Version: app.Info.Version,
			})
		}
	}

	dataSources, err := hs.getFSDataSources(c, enabledPlugins)
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
	for _, panel := range enabledPlugins[plugins.Panel] {
		if panel.State == plugins.AlphaRelease && !hs.Cfg.PluginsEnableAlpha {
			continue
		}

		hideFromList := panel.HideFromList
		if panel.ID == "flamegraph" {
			hideFromList = !hs.Features.IsEnabled(featuremgmt.FlagFlameGraph)
		}

		panels[panel.ID] = plugins.PanelDTO{
			ID:            panel.ID,
			Name:          panel.Name,
			Info:          panel.Info,
			Module:        panel.Module,
			BaseURL:       panel.BaseURL,
			SkipDataQuery: panel.SkipDataQuery,
			HideFromList:  hideFromList,
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

	jsonObj := map[string]interface{}{
		"defaultDatasource":                   defaultDS,
		"datasources":                         dataSources,
		"minRefreshInterval":                  setting.MinRefreshInterval,
		"panels":                              panels,
		"appUrl":                              hs.Cfg.AppURL,
		"appSubUrl":                           hs.Cfg.AppSubURL,
		"allowOrgCreate":                      (setting.AllowUserOrgCreate && c.IsSignedIn) || c.IsGrafanaAdmin,
		"authProxyEnabled":                    setting.AuthProxyEnabled,
		"ldapEnabled":                         hs.Cfg.LDAPAuthEnabled,
		"jwtHeaderName":                       hs.Cfg.JWTAuthHeaderName,
		"jwtUrlLogin":                         hs.Cfg.JWTAuthURLLogin,
		"alertingEnabled":                     setting.AlertingEnabled,
		"alertingErrorOrTimeout":              setting.AlertingErrorOrTimeout,
		"alertingNoDataOrNullValues":          setting.AlertingNoDataOrNullValues,
		"alertingMinInterval":                 setting.AlertingMinInterval,
		"liveEnabled":                         hs.Cfg.LiveMaxConnections != 0,
		"autoAssignOrg":                       setting.AutoAssignOrg,
		"verifyEmailEnabled":                  setting.VerifyEmailEnabled,
		"sigV4AuthEnabled":                    setting.SigV4AuthEnabled,
		"azureAuthEnabled":                    setting.AzureAuthEnabled,
		"rbacEnabled":                         hs.Cfg.RBACEnabled,
		"exploreEnabled":                      setting.ExploreEnabled,
		"helpEnabled":                         setting.HelpEnabled,
		"profileEnabled":                      setting.ProfileEnabled,
		"queryHistoryEnabled":                 hs.Cfg.QueryHistoryEnabled,
		"googleAnalyticsId":                   setting.GoogleAnalyticsId,
		"googleAnalytics4Id":                  setting.GoogleAnalytics4Id,
		"GoogleAnalytics4SendManualPageViews": setting.GoogleAnalytics4SendManualPageViews,
		"rudderstackWriteKey":                 setting.RudderstackWriteKey,
		"rudderstackDataPlaneUrl":             setting.RudderstackDataPlaneUrl,
		"rudderstackSdkUrl":                   setting.RudderstackSdkUrl,
		"rudderstackConfigUrl":                setting.RudderstackConfigUrl,
		"feedbackLinksEnabled":                hs.Cfg.FeedbackLinksEnabled,
		"applicationInsightsConnectionString": hs.Cfg.ApplicationInsightsConnectionString,
		"applicationInsightsEndpointUrl":      hs.Cfg.ApplicationInsightsEndpointUrl,
		"disableLoginForm":                    setting.DisableLoginForm,
		"disableUserSignUp":                   !setting.AllowUserSignUp,
		"loginHint":                           setting.LoginHint,
		"passwordHint":                        setting.PasswordHint,
		"externalUserMngInfo":                 setting.ExternalUserMngInfo,
		"externalUserMngLinkUrl":              setting.ExternalUserMngLinkUrl,
		"externalUserMngLinkName":             setting.ExternalUserMngLinkName,
		"viewersCanEdit":                      setting.ViewersCanEdit,
		"angularSupportEnabled":               hs.Cfg.AngularSupportEnabled,
		"editorsCanAdmin":                     hs.Cfg.EditorsCanAdmin,
		"disableSanitizeHtml":                 hs.Cfg.DisableSanitizeHtml,
		"pluginsToPreload":                    pluginsToPreload,
		"auth": map[string]interface{}{
			"OAuthSkipOrgRoleUpdateSync": hs.Cfg.OAuthSkipOrgRoleUpdateSync,
			"SAMLSkipOrgRoleSync":        hs.Cfg.SectionWithEnvOverrides("auth.saml").Key("skip_org_role_sync").MustBool(false),
			"LDAPSkipOrgRoleSync":        hs.Cfg.LDAPSkipOrgRoleSync,
			"GithubSkipOrgRoleSync":      hs.Cfg.GitHubSkipOrgRoleSync,
			"GoogleSkipOrgRoleSync":      hs.Cfg.GoogleSkipOrgRoleSync,
			"JWTAuthSkipOrgRoleSync":     hs.Cfg.JWTAuthSkipOrgRoleSync,
			"GrafanaComSkipOrgRoleSync":  hs.Cfg.GrafanaComSkipOrgRoleSync,
			"GitLabSkipOrgRoleSync":      hs.Cfg.GitLabSkipOrgRoleSync,
			"AzureADSkipOrgRoleSync":     hs.Cfg.AzureADSkipOrgRoleSync,
			"OktaSkipOrgRoleSync":        hs.Cfg.OktaSkipOrgRoleSync,
			"DisableSyncLock":            hs.Cfg.DisableSyncLock,
		},
		"buildInfo": map[string]interface{}{
			"hideVersion":   hideVersion,
			"version":       version,
			"commit":        commit,
			"buildstamp":    buildstamp,
			"edition":       hs.License.Edition(),
			"latestVersion": hs.grafanaUpdateChecker.LatestVersion(),
			"hasUpdate":     hs.grafanaUpdateChecker.UpdateAvailable(),
			"env":           setting.Env,
		},
		"licenseInfo": map[string]interface{}{
			"expiry":          hs.License.Expiry(),
			"stateInfo":       hs.License.StateInfo(),
			"licenseUrl":      hs.License.LicenseURL(hasAccess(accesscontrol.ReqGrafanaAdmin, licensing.PageAccess)),
			"edition":         hs.License.Edition(),
			"enabledFeatures": hs.License.EnabledFeatures(),
		},
		"featureToggles":                   hs.Features.GetEnabled(c.Req.Context()),
		"anonymousEnabled":                 hs.Cfg.AnonymousEnabled,
		"rendererAvailable":                hs.RenderService.IsAvailable(c.Req.Context()),
		"rendererVersion":                  hs.RenderService.Version(),
		"secretsManagerPluginEnabled":      secretsManagerPluginEnabled,
		"http2Enabled":                     hs.Cfg.Protocol == setting.HTTP2Scheme,
		"sentry":                           hs.Cfg.Sentry,
		"grafanaJavascriptAgent":           hs.Cfg.GrafanaJavascriptAgent,
		"pluginCatalogURL":                 hs.Cfg.PluginCatalogURL,
		"pluginAdminEnabled":               hs.Cfg.PluginAdminEnabled,
		"pluginAdminExternalManageEnabled": hs.Cfg.PluginAdminEnabled && hs.Cfg.PluginAdminExternalManageEnabled,
		"pluginCatalogHiddenPlugins":       hs.Cfg.PluginCatalogHiddenPlugins,
		"expressionsEnabled":               hs.Cfg.ExpressionsEnabled,
		"awsAllowedAuthProviders":          hs.Cfg.AWSAllowedAuthProviders,
		"awsAssumeRoleEnabled":             hs.Cfg.AWSAssumeRoleEnabled,
		"supportBundlesEnabled":            isSupportBundlesEnabled(hs),
		"azure": map[string]interface{}{
			"cloud":                  hs.Cfg.Azure.Cloud,
			"managedIdentityEnabled": hs.Cfg.Azure.ManagedIdentityEnabled,
		},
		"caching": map[string]bool{
			"enabled": hs.Cfg.SectionWithEnvOverrides("caching").Key("enabled").MustBool(true),
		},
		"recordedQueries": map[string]bool{
			"enabled": hs.Cfg.SectionWithEnvOverrides("recorded_queries").Key("enabled").MustBool(true),
		},
		"reporting": map[string]bool{
			"enabled": hs.Cfg.SectionWithEnvOverrides("reporting").Key("enabled").MustBool(true),
		},
		"unifiedAlertingEnabled": hs.Cfg.UnifiedAlerting.Enabled,
		"unifiedAlerting": map[string]interface{}{
			"minInterval": hs.Cfg.UnifiedAlerting.MinInterval.String(),
		},
		"oauth":                   hs.getEnabledOAuthProviders(),
		"samlEnabled":             hs.samlEnabled(),
		"samlName":                hs.samlName(),
		"tokenExpirationDayLimit": hs.Cfg.SATokenExpirationDayLimit,
		"snapshotEnabled":         hs.Cfg.SnapshotEnabled,
	}

	if hs.pluginsCDNService != nil && hs.pluginsCDNService.IsEnabled() {
		cdnBaseURL, err := hs.pluginsCDNService.BaseURL()
		if err != nil {
			return nil, fmt.Errorf("plugins cdn base url: %w", err)
		}
		jsonObj["pluginsCDNBaseURL"] = cdnBaseURL
	}

	if hs.ThumbService != nil {
		jsonObj["dashboardPreviews"] = hs.ThumbService.GetDashboardPreviewsSetupSettings(c)
	}

	if hs.Cfg.GeomapDefaultBaseLayerConfig != nil {
		jsonObj["geomapDefaultBaseLayerConfig"] = hs.Cfg.GeomapDefaultBaseLayerConfig
	}
	if !hs.Cfg.GeomapEnableCustomBaseLayers {
		jsonObj["geomapDisableCustomBaseLayer"] = true
	}

	return jsonObj, nil
}

func isSupportBundlesEnabled(hs *HTTPServer) bool {
	return hs.Cfg.SectionWithEnvOverrides("support_bundles").Key("enabled").MustBool(false) &&
		hs.Features.IsEnabled(featuremgmt.FlagSupportBundles)
}

func (hs *HTTPServer) getFSDataSources(c *contextmodel.ReqContext, enabledPlugins EnabledPlugins) (map[string]plugins.DataSourceDTO, error) {
	orgDataSources := make([]*datasources.DataSource, 0)
	if c.OrgID != 0 {
		query := datasources.GetDataSourcesQuery{OrgId: c.OrgID, DataSourceLimit: hs.Cfg.DataSourceLimit}
		err := hs.DataSourcesService.GetDataSources(c.Req.Context(), &query)
		if err != nil {
			return nil, err
		}

		if c.IsPublicDashboardView {
			// If RBAC is enabled, it will filter out all datasources for a public user, so we need to skip it
			orgDataSources = query.Result
		} else {
			filtered, err := hs.filterDatasourcesByQueryPermission(c.Req.Context(), c.SignedInUser, query.Result)
			if err != nil {
				return nil, err
			}
			orgDataSources = filtered
		}
	}

	dataSources := make(map[string]plugins.DataSourceDTO)

	for _, ds := range orgDataSources {
		url := ds.Url

		if ds.Access == datasources.DS_ACCESS_PROXY {
			url = "/api/datasources/proxy/uid/" + ds.Uid
		}

		dsDTO := plugins.DataSourceDTO{
			ID:        ds.Id,
			UID:       ds.Uid,
			Type:      ds.Type,
			Name:      ds.Name,
			URL:       url,
			IsDefault: ds.IsDefault,
			Access:    string(ds.Access),
			ReadOnly:  ds.ReadOnly,
		}

		plugin, exists := enabledPlugins.Get(plugins.DataSource, ds.Type)
		if !exists {
			c.Logger.Error("Could not find plugin definition for data source", "datasource_type", ds.Type)
			continue
		}
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
			ds.JsonData.Set("directUrl", ds.Url)
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

// EnabledPlugins represents a mapping from plugin types (panel, data source, etc.) to plugin IDs to plugins
// For example ["panel"] -> ["piechart"] -> {pie chart plugin DTO}
type EnabledPlugins map[plugins.Type]map[string]plugins.PluginDTO

func (ep EnabledPlugins) Get(pluginType plugins.Type, pluginID string) (plugins.PluginDTO, bool) {
	if _, exists := ep[pluginType][pluginID]; exists {
		return ep[pluginType][pluginID], true
	}

	return plugins.PluginDTO{}, false
}

func (hs *HTTPServer) enabledPlugins(ctx context.Context, orgID int64) (EnabledPlugins, error) {
	ep := make(EnabledPlugins)

	pluginSettingMap, err := hs.pluginSettings(ctx, orgID)
	if err != nil {
		return ep, err
	}

	apps := make(map[string]plugins.PluginDTO)
	for _, app := range hs.pluginStore.Plugins(ctx, plugins.App) {
		if b, exists := pluginSettingMap[app.ID]; exists {
			app.Pinned = b.Pinned
			apps[app.ID] = app
		}
	}
	ep[plugins.App] = apps

	dataSources := make(map[string]plugins.PluginDTO)
	for _, ds := range hs.pluginStore.Plugins(ctx, plugins.DataSource) {
		if _, exists := pluginSettingMap[ds.ID]; exists {
			dataSources[ds.ID] = ds
		}
	}
	ep[plugins.DataSource] = dataSources

	panels := make(map[string]plugins.PluginDTO)
	for _, p := range hs.pluginStore.Plugins(ctx, plugins.Panel) {
		if _, exists := pluginSettingMap[p.ID]; exists {
			panels[p.ID] = p
		}
	}
	ep[plugins.Panel] = panels

	return ep, nil
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

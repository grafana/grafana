package config

import (
	"fmt"
	"strings"

	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func ProvideConfig(settingProvider setting.Provider, grafanaCfg *setting.Cfg, features featuremgmt.FeatureToggles) (*pCfg.Cfg, error) {
	plugins := settingProvider.Section("plugins")
	allowedUnsigned := grafanaCfg.PluginsAllowUnsigned
	if len(plugins.KeyValue("allow_loading_unsigned_plugins").Value()) > 0 {
		allowedUnsigned = strings.Split(plugins.KeyValue("allow_loading_unsigned_plugins").Value(), ",")
	}

	// Get aws settings from settingProvider instead of grafanaCfg
	aws := settingProvider.Section("aws")
	allowedAuth := grafanaCfg.AWSAllowedAuthProviders
	if len(aws.KeyValue("allowed_auth_providers").Value()) > 0 {
		allowedAuth = util.SplitString(aws.KeyValue("allowed_auth_providers").Value())
	}
	if len(allowedAuth) > 0 {
		allowedUnsigned = strings.Split(settingProvider.KeyValue("plugins", "allow_loading_unsigned_plugins").Value(), ",")
	}
	awsForwardSettingsPlugins := grafanaCfg.AWSForwardSettingsPlugins
	if len(aws.KeyValue("forward_settings_to_plugins").Value()) > 0 {
		awsForwardSettingsPlugins = util.SplitString(aws.KeyValue("forward_settings_to_plugins").Value())
	}

	tracingCfg, err := newTracingCfg(grafanaCfg)
	if err != nil {
		return nil, fmt.Errorf("new opentelemetry cfg: %w", err)
	}

	return pCfg.NewCfg(
		settingProvider.KeyValue("", "app_mode").MustBool(grafanaCfg.Env == setting.Dev),
		grafanaCfg.PluginsPath,
		extractPluginSettings(settingProvider),
		allowedUnsigned,
		allowedAuth,
		aws.KeyValue("assume_role_enabled").MustBool(grafanaCfg.AWSAssumeRoleEnabled),
		aws.KeyValue("external_id").Value(),
		aws.KeyValue("session_duration").Value(),
		aws.KeyValue("list_metrics_page_limit").Value(),
		awsForwardSettingsPlugins,
		grafanaCfg.Azure,
		grafanaCfg.SecureSocksDSProxy,
		grafanaCfg.BuildVersion,
		grafanaCfg.PluginLogBackendRequests,
		grafanaCfg.PluginsCDNURLTemplate,
		grafanaCfg.AppURL,
		grafanaCfg.AppSubURL,
		tracingCfg,
		features,
		grafanaCfg.AngularSupportEnabled,
		grafanaCfg.GrafanaComURL,
		grafanaCfg.DisablePlugins,
		grafanaCfg.HideAngularDeprecation,
		grafanaCfg.ForwardHostEnvVars,
		grafanaCfg.ConcurrentQueryCount,
		grafanaCfg.AzureAuthEnabled,
		grafanaCfg.UserFacingDefaultError,
		grafanaCfg.DataProxyRowLimit,
		grafanaCfg.SqlDatasourceMaxOpenConnsDefault,
		grafanaCfg.SqlDatasourceMaxIdleConnsDefault,
		grafanaCfg.SqlDatasourceMaxConnLifetimeDefault,
	), nil
}

func extractPluginSettings(settingProvider setting.Provider) setting.PluginSettings {
	ps := setting.PluginSettings{}
	for sectionName, sectionCopy := range settingProvider.Current() {
		if !strings.HasPrefix(sectionName, "plugin.") {
			continue
		}
		// Calling Current() returns a redacted version of section. We need to replace the map values with the unredacted values.
		section := settingProvider.Section(sectionName)
		for k := range sectionCopy {
			sectionCopy[k] = section.KeyValue(k).MustString("")
		}
		pluginID := strings.Replace(sectionName, "plugin.", "", 1)
		ps[pluginID] = sectionCopy
	}

	return ps
}

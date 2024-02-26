package pluginconfig

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvidePluginManagementConfig returns a new pCfg.PluginsCfg.
// It is used to provide configuration to Grafana's implementation of the plugin management system.
func ProvidePluginManagementConfig(settingProvider setting.Provider, grafanaCfg *setting.Cfg, features featuremgmt.FeatureToggles) (*pCfg.PluginsCfg, error) {
	plugins := settingProvider.Section("plugins")
	allowedUnsigned := grafanaCfg.PluginsAllowUnsigned
	if len(plugins.KeyValue("allow_loading_unsigned_plugins").Value()) > 0 {
		allowedUnsigned = strings.Split(plugins.KeyValue("allow_loading_unsigned_plugins").Value(), ",")
	}

	tracingCfg, err := newTracingCfg(grafanaCfg)
	if err != nil {
		return nil, fmt.Errorf("new opentelemetry cfg: %w", err)
	}

	return pCfg.NewPluginsCfg(
		settingProvider.KeyValue("", "app_mode").MustBool(grafanaCfg.Env == setting.Dev),
		grafanaCfg.PluginsPath,
		extractPluginSettings(settingProvider),
		allowedUnsigned,
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
	), nil
}

// PluginInstanceCfg contains the configuration for a plugin instance.
// It is used to provide configuration to the plugin instance either via env vars or via each plugin request.
type PluginInstanceCfg struct {
	GrafanaAppURL string
	Features      featuremgmt.FeatureToggles

	Tracing pCfg.Tracing

	PluginSettings setting.PluginSettings

	AWSAllowedAuthProviders   []string
	AWSAssumeRoleEnabled      bool
	AWSExternalId             string
	AWSSessionDuration        string
	AWSListMetricsPageLimit   string
	AWSForwardSettingsPlugins []string

	// Azure Cloud settings
	Azure            *azsettings.AzureSettings
	AzureAuthEnabled bool

	// Proxy Settings
	ProxySettings setting.SecureSocksDSProxySettings

	GrafanaVersion string

	ConcurrentQueryCount int

	UserFacingDefaultError string

	DataProxyRowLimit int64

	SQLDatasourceMaxOpenConnsDefault    int
	SQLDatasourceMaxIdleConnsDefault    int
	SQLDatasourceMaxConnLifetimeDefault int
}

// ProvidePluginInstanceConfig returns a new PluginInstanceCfg.
func ProvidePluginInstanceConfig(settingProvider setting.Provider, grafanaCfg *setting.Cfg, features featuremgmt.FeatureToggles) (*PluginInstanceCfg, error) {
	aws := settingProvider.Section("aws")
	allowedAuth := grafanaCfg.AWSAllowedAuthProviders
	if len(aws.KeyValue("allowed_auth_providers").Value()) > 0 {
		allowedAuth = util.SplitString(aws.KeyValue("allowed_auth_providers").Value())
	}
	awsForwardSettingsPlugins := grafanaCfg.AWSForwardSettingsPlugins
	if len(aws.KeyValue("forward_settings_to_plugins").Value()) > 0 {
		awsForwardSettingsPlugins = util.SplitString(aws.KeyValue("forward_settings_to_plugins").Value())
	}

	tracingCfg, err := newTracingCfg(grafanaCfg)
	if err != nil {
		return nil, fmt.Errorf("new opentelemetry cfg: %w", err)
	}

	return &PluginInstanceCfg{
		GrafanaAppURL:                       grafanaCfg.AppURL,
		Features:                            features,
		Tracing:                             tracingCfg,
		PluginSettings:                      extractPluginSettings(settingProvider),
		AWSAllowedAuthProviders:             allowedAuth,
		AWSAssumeRoleEnabled:                aws.KeyValue("assume_role_enabled").MustBool(grafanaCfg.AWSAssumeRoleEnabled),
		AWSExternalId:                       aws.KeyValue("external_id").Value(),
		AWSSessionDuration:                  aws.KeyValue("session_duration").Value(),
		AWSListMetricsPageLimit:             aws.KeyValue("list_metrics_page_limit").Value(),
		AWSForwardSettingsPlugins:           awsForwardSettingsPlugins,
		Azure:                               grafanaCfg.Azure,
		AzureAuthEnabled:                    grafanaCfg.Azure.AzureAuthEnabled,
		ProxySettings:                       grafanaCfg.SecureSocksDSProxy,
		GrafanaVersion:                      grafanaCfg.BuildVersion,
		ConcurrentQueryCount:                grafanaCfg.ConcurrentQueryCount,
		UserFacingDefaultError:              grafanaCfg.UserFacingDefaultError,
		DataProxyRowLimit:                   grafanaCfg.DataProxyRowLimit,
		SQLDatasourceMaxOpenConnsDefault:    grafanaCfg.SqlDatasourceMaxOpenConnsDefault,
		SQLDatasourceMaxIdleConnsDefault:    grafanaCfg.SqlDatasourceMaxIdleConnsDefault,
		SQLDatasourceMaxConnLifetimeDefault: grafanaCfg.SqlDatasourceMaxConnLifetimeDefault,
	}, nil

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

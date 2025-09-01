package pluginconfig

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvidePluginManagementConfig returns a new config.PluginManagementCfg.
// It is used to provide configuration to Grafana's implementation of the plugin management system.
func ProvidePluginManagementConfig(cfg *setting.Cfg, settingProvider setting.Provider, features featuremgmt.FeatureToggles) (*config.PluginManagementCfg, error) {
	plugins := settingProvider.Section("plugins")
	allowedUnsigned := cfg.PluginsAllowUnsigned
	if len(plugins.KeyValue("allow_loading_unsigned_plugins").Value()) > 0 {
		allowedUnsigned = strings.Split(plugins.KeyValue("allow_loading_unsigned_plugins").Value(), ",")
	}

	return config.NewPluginManagementCfg(
		settingProvider.KeyValue("", "app_mode").MustBool(cfg.Env == setting.Dev),
		cfg.PluginsPath,
		extractPluginSettings(settingProvider),
		allowedUnsigned,
		cfg.PluginsCDNURLTemplate,
		cfg.AppURL,
		config.Features{
			SkipHostEnvVarsEnabled: features.IsEnabledGlobally(featuremgmt.FlagPluginsSkipHostEnvVars),
			SriChecksEnabled:       features.IsEnabledGlobally(featuremgmt.FlagPluginsSriChecks),
			TempoAlertingEnabled:   features.IsEnabledGlobally(featuremgmt.FlagTempoAlerting),
			PluginAssetProvider:    features.IsEnabledGlobally(featuremgmt.FlagPluginAssetProvider),
		},
		cfg.GrafanaComAPIURL,
		cfg.DisablePlugins,
		cfg.HideAngularDeprecation,
		cfg.ForwardHostEnvVars,
		cfg.GrafanaComSSOAPIToken,
	), nil
}

// PluginInstanceCfg contains the configuration for a plugin instance.
// It is used to provide configuration to the plugin instance either via env vars or via each plugin request.
type PluginInstanceCfg struct {
	GrafanaAppURL string
	Features      featuremgmt.FeatureToggles

	Tracing config.Tracing

	PluginSettings setting.PluginSettings

	AWSAllowedAuthProviders   []string
	AWSAssumeRoleEnabled      bool
	AWSExternalId             string
	AWSSessionDuration        string
	AWSListMetricsPageLimit   string
	AWSForwardSettingsPlugins []string

	Azure            *azsettings.AzureSettings
	AzureAuthEnabled bool

	ProxySettings setting.SecureSocksDSProxySettings

	GrafanaVersion string

	ConcurrentQueryCount int
	ResponseLimit        int64

	UserFacingDefaultError string

	DataProxyRowLimit int64

	SQLDatasourceMaxOpenConnsDefault    int
	SQLDatasourceMaxIdleConnsDefault    int
	SQLDatasourceMaxConnLifetimeDefault int

	SigV4AuthEnabled    bool
	SigV4VerboseLogging bool
}

// ProvidePluginInstanceConfig returns a new PluginInstanceCfg.
func ProvidePluginInstanceConfig(cfg *setting.Cfg, settingProvider setting.Provider, features featuremgmt.FeatureToggles) (*PluginInstanceCfg, error) {
	aws := settingProvider.Section("aws")
	allowedAuth := cfg.AWSAllowedAuthProviders
	if len(aws.KeyValue("allowed_auth_providers").Value()) > 0 {
		allowedAuth = util.SplitString(aws.KeyValue("allowed_auth_providers").Value())
	}
	awsForwardSettingsPlugins := cfg.AWSForwardSettingsPlugins
	if len(aws.KeyValue("forward_settings_to_plugins").Value()) > 0 {
		awsForwardSettingsPlugins = util.SplitString(aws.KeyValue("forward_settings_to_plugins").Value())
	}

	tracingCfg, err := newTracingCfg(cfg)
	if err != nil {
		return nil, fmt.Errorf("new opentelemetry cfg: %w", err)
	}

	if cfg.Azure == nil {
		cfg.Azure = &azsettings.AzureSettings{}
	}

	return &PluginInstanceCfg{
		GrafanaAppURL:                       cfg.AppURL,
		Features:                            features,
		Tracing:                             tracingCfg,
		PluginSettings:                      extractPluginSettings(settingProvider),
		AWSAllowedAuthProviders:             allowedAuth,
		AWSAssumeRoleEnabled:                aws.KeyValue("assume_role_enabled").MustBool(cfg.AWSAssumeRoleEnabled),
		AWSExternalId:                       aws.KeyValue("external_id").Value(),
		AWSSessionDuration:                  aws.KeyValue("session_duration").Value(),
		AWSListMetricsPageLimit:             aws.KeyValue("list_metrics_page_limit").Value(),
		AWSForwardSettingsPlugins:           awsForwardSettingsPlugins,
		Azure:                               cfg.Azure,
		AzureAuthEnabled:                    cfg.Azure.AzureAuthEnabled,
		ProxySettings:                       cfg.SecureSocksDSProxy,
		GrafanaVersion:                      cfg.BuildVersion,
		ConcurrentQueryCount:                cfg.ConcurrentQueryCount,
		UserFacingDefaultError:              cfg.UserFacingDefaultError,
		DataProxyRowLimit:                   cfg.DataProxyRowLimit,
		SQLDatasourceMaxOpenConnsDefault:    cfg.SqlDatasourceMaxOpenConnsDefault,
		SQLDatasourceMaxIdleConnsDefault:    cfg.SqlDatasourceMaxIdleConnsDefault,
		SQLDatasourceMaxConnLifetimeDefault: cfg.SqlDatasourceMaxConnLifetimeDefault,
		ResponseLimit:                       cfg.ResponseLimit,
		SigV4AuthEnabled:                    cfg.SigV4AuthEnabled,
		SigV4VerboseLogging:                 cfg.SigV4VerboseLogging,
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

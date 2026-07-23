package pluginconfig

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/externaloverrides"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var logger = log.New("plugins.externaloverrides")

// ProvidePluginManagementConfig returns a new config.PluginManagementCfg.
// It is used to provide configuration to Grafana's implementation of the plugin management system.
func ProvidePluginManagementConfig(cfg *setting.Cfg, settingProvider setting.Provider, features featuremgmt.FeatureToggles) (*config.PluginManagementCfg, error) {
	plugins := settingProvider.Section("plugins")
	allowedUnsigned := cfg.PluginsAllowUnsigned
	if len(plugins.KeyValue("allow_loading_unsigned_plugins").Value()) > 0 {
		allowedUnsigned = strings.Split(plugins.KeyValue("allow_loading_unsigned_plugins").Value(), ",")
	}

	pluginSettings := extractPluginSettings(settingProvider)

	pCfg := config.NewPluginManagementCfg(
		settingProvider.KeyValue("", "app_mode").MustBool(cfg.Env == setting.Dev),
		cfg.PluginsPaths,
		pluginSettings,
		allowedUnsigned,
		cfg.PluginsCDNURLTemplate,
		cfg.AppURL,
		//nolint:staticcheck // not yet migrated to OpenFeature
		config.Features{
			SriChecksEnabled:     features.IsEnabledGlobally(featuremgmt.FlagPluginsSriChecks),
			TempoAlertingEnabled: features.IsEnabledGlobally(featuremgmt.FlagTempoAlerting),
		},
		cfg.GrafanaComAPIURL,
		cfg.DisablePlugins,
		cfg.ForwardHostEnvVars,
		cfg.GrafanaComProxyAPIToken,
	)
	pCfg.ActiveExternalOverrides = externalOverridesFromIni(cfg, pluginSettings)
	return pCfg, nil
}

// externalOverridesFromIni builds the active external override list by scanning plugin ini settings.
// For each known override, activation is determined by two operator-set ini keys:
//   - [plugin.<CorePluginID>] as_external = true  — tells the AsExternal pipeline step to skip loading the core bundle
//   - [plugin.<ExternalPluginID>] alias_ids = <CorePluginID,...>  — injects the alias and activates the override
//
// Both keys must be set for a Migrating override to be fully active. OverrideStagePermanent overrides
// are always active regardless of ini config, for backwards compatibility after the core plugin is deleted.
// A misconfiguration warning is logged if an override is active but the external plugin is not in the preinstall list.
func externalOverridesFromIni(cfg *setting.Cfg, pluginSettings config.PluginSettings) []config.ExternalOverride {
	preinstalled := make(map[string]bool, len(cfg.PreinstallPluginsAsync))
	for _, p := range cfg.PreinstallPluginsAsync {
		preinstalled[p.ID] = true
	}

	var activeOverrides []config.ExternalOverride
	for _, o := range externaloverrides.Overrides {
		active := o.Stage == externaloverrides.OverrideStagePermanent || isAliasConfigured(pluginSettings, o)
		if active {
			if !preinstalled[o.ExternalPluginID] {
				logger.Warn("External plugin override is active but plugin is not in the preinstall list — it must be installed manually",
					"corePluginID", o.CorePluginID,
					"externalPluginID", o.ExternalPluginID,
				)
			}
			activeOverrides = append(activeOverrides, config.ExternalOverride{
				CorePluginID:     o.CorePluginID,
				ExternalPluginID: o.ExternalPluginID,
			})
		}
	}
	return activeOverrides
}

// isAliasConfigured returns true when the external plugin's ini section declares alias_ids
// containing the core plugin ID, indicating the operator has opted in to the migration.
func isAliasConfigured(pluginSettings config.PluginSettings, o externaloverrides.Override) bool {
	extSettings, ok := pluginSettings[o.ExternalPluginID]
	if !ok {
		return false
	}
	raw := extSettings["alias_ids"]
	if raw == "" {
		return false
	}
	for _, alias := range strings.Split(raw, ",") {
		if strings.TrimSpace(alias) == o.CorePluginID {
			return true
		}
	}
	return false
}

// PluginInstanceCfg contains the configuration for a plugin instance.
// It is used to provide configuration to the plugin instance either via env vars or via each plugin request.
type PluginInstanceCfg struct {
	GrafanaAppURL               string
	MarketplaceLicenseDirectory string
	Features                    featuremgmt.FeatureToggles

	Tracing config.Tracing

	PluginSettings config.PluginSettings

	AWSAllowedAuthProviders          []string
	AWSAssumeRoleEnabled             bool
	AWSPerDatasourceHTTPProxyEnabled bool
	AWSExternalId                    string
	AWSSessionDuration               string
	AWSListMetricsPageLimit          string
	AWSForwardSettingsPlugins        []string

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

	LiveClientQueueMaxSize int
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
		MarketplaceLicenseDirectory:         cfg.MarketplaceLicenseDirectory,
		Features:                            features,
		Tracing:                             tracingCfg,
		PluginSettings:                      extractPluginSettings(settingProvider),
		AWSAllowedAuthProviders:             allowedAuth,
		AWSAssumeRoleEnabled:                aws.KeyValue("assume_role_enabled").MustBool(cfg.AWSAssumeRoleEnabled),
		AWSPerDatasourceHTTPProxyEnabled:    aws.KeyValue("per_datasource_http_proxy_enabled").MustBool(cfg.AWSPerDatasourceHTTPProxyEnabled),
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
		LiveClientQueueMaxSize:              cfg.LiveClientQueueMaxSize,
	}, nil
}

func extractPluginSettings(settingProvider setting.Provider) config.PluginSettings {
	ps := config.PluginSettings{}
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

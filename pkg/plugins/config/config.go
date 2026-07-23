package config

// PluginManagementCfg is the configuration for the plugin management system.
// It includes settings which are used to configure different components of plugin management.
type PluginManagementCfg struct {
	DevMode bool

	// PluginsPaths: list of paths where Grafana will look for plugins.
	// Order is important, if multiple paths contain the same plugin, only the first one will be used.
	PluginsPaths []string

	PluginSettings       PluginSettings
	PluginsAllowUnsigned []string
	DisablePlugins       []string
	ForwardHostEnvVars   []string

	PluginsCDNURLTemplate string

	GrafanaComAPIURL   string
	GrafanaComAPIToken string

	GrafanaAppURL string

	Features Features

	// ActiveExternalOverrides is the set of external plugin overrides that are currently active,
	// either because the operator has configured alias_ids in the ini file or because the stage
	// is OverrideStagePermanent. It is the single source of truth for the pipeline and bootstrap
	// stages, avoiding re-derivation from PluginSettings.
	ActiveExternalOverrides []ExternalOverride
}

// ExternalOverride carries the IDs needed at pipeline time for an active external plugin override.
type ExternalOverride struct {
	CorePluginID     string
	ExternalPluginID string
}

// Features contains the feature toggles used for the plugin management system.
type Features struct {
	SriChecksEnabled       bool
	LocalizationForPlugins bool
	// Needed only until Tempo Alerting / metrics TraceQL is stable
	// https://github.com/grafana/grafana/issues/106888
	TempoAlertingEnabled bool
}

// PluginSettings maps plugin id to map of key/value settings.
type PluginSettings map[string]map[string]string

// NewPluginManagementCfg returns a new PluginManagementCfg.
func NewPluginManagementCfg(devMode bool, pluginsPaths []string, pluginSettings PluginSettings, pluginsAllowUnsigned []string,
	pluginsCDNURLTemplate string, appURL string, features Features,
	grafanaComAPIURL string, disablePlugins []string, forwardHostEnvVars []string, grafanaComAPIToken string,
	activeExternalOverrides []ExternalOverride,
) *PluginManagementCfg {
	return &PluginManagementCfg{
		PluginsPaths:            pluginsPaths,
		DevMode:                 devMode,
		PluginSettings:          pluginSettings,
		PluginsAllowUnsigned:    pluginsAllowUnsigned,
		DisablePlugins:          disablePlugins,
		PluginsCDNURLTemplate:   pluginsCDNURLTemplate,
		GrafanaComAPIURL:        grafanaComAPIURL,
		GrafanaAppURL:           appURL,
		Features:                features,
		ForwardHostEnvVars:      forwardHostEnvVars,
		GrafanaComAPIToken:      grafanaComAPIToken,
		ActiveExternalOverrides: activeExternalOverrides,
	}
}

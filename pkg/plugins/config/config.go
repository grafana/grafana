package config

// PluginManagementCfg is the configuration for the plugin management system.
// It includes settings which are used to configure different components of plugin management.
type PluginManagementCfg struct {
	DevMode bool

	// PluginsPaths: list of paths where Grafana will look for plugins.
	// Order is important: if multiple paths contain the same plugin, only the first one is used.
	// The bundling logic also depends on this:
	//   [0] is the user-writable plugins directory (e.g. data/plugins)
	//   [1] is the bundled plugin directory (e.g. data/plugins-bundled)
	// Code that distinguishes installed from bundled plugins (e.g. DisableBundledPlugins
	// filtering in DirAsLocalSources) relies on [0] being the regular (non-bundled) directory.
	PluginsPaths []string

	PluginSettings        PluginSettings
	PluginsAllowUnsigned  []string
	DisablePlugins        []string
	DisableBundledPlugins []string
	ForwardHostEnvVars    []string

	PluginsCDNURLTemplate string

	GrafanaComAPIURL   string
	GrafanaComAPIToken string

	GrafanaAppURL string

	Features Features
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
	grafanaComAPIURL string, disablePlugins []string, disableBundledPlugins []string, forwardHostEnvVars []string, grafanaComAPIToken string,
) *PluginManagementCfg {
	return &PluginManagementCfg{
		PluginsPaths:          pluginsPaths,
		DevMode:               devMode,
		PluginSettings:        pluginSettings,
		PluginsAllowUnsigned:  pluginsAllowUnsigned,
		DisablePlugins:        disablePlugins,
		DisableBundledPlugins: disableBundledPlugins,
		PluginsCDNURLTemplate: pluginsCDNURLTemplate,
		GrafanaComAPIURL:      grafanaComAPIURL,
		GrafanaAppURL:         appURL,
		Features:              features,
		ForwardHostEnvVars:    forwardHostEnvVars,
		GrafanaComAPIToken:    grafanaComAPIToken,
	}
}

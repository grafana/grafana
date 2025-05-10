package setting

import (
	"os"
	"regexp"
	"strings"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
)

const (
	PluginUpdateStrategyLatest = "latest"
	PluginUpdateStrategyMinor  = "minor"
)

// PluginSettings maps plugin id to map of key/value settings.
type PluginSettings map[string]map[string]string

func extractPluginSettings(sections []*ini.Section) PluginSettings {
	psMap := PluginSettings{}
	for _, section := range sections {
		sectionName := section.Name()
		if !strings.HasPrefix(sectionName, "plugin.") {
			continue
		}

		pluginID := strings.Replace(sectionName, "plugin.", "", 1)
		psMap[pluginID] = section.KeysHash()
	}

	return psMap
}

var (
	defaultPreinstallPlugins = map[string]InstallPlugin{
		// Default preinstalled plugins
		"grafana-lokiexplore-app":      {ID: "grafana-lokiexplore-app"},
		"grafana-pyroscope-app":        {ID: "grafana-pyroscope-app"},
		"grafana-exploretraces-app":    {ID: "grafana-exploretraces-app"},
		"grafana-metricsdrilldown-app": {ID: "grafana-metricsdrilldown-app"},
	}
)

// processLegacyInstallPlugins creates list of plugins from GF_INSTALL_PLUGINS
// if plugins are present in preinstallPlugins, it won't be processed
// preinstallPlugins has priority over GF_INSTALL_PLUGINS
func (cfg *Cfg) processLegacyInstallPlugins(preinstallPlugins map[string]InstallPlugin, installPluginsVal string, installPluginsForce string) map[string]InstallPlugin {
	pluginsToInstall := make(map[string]InstallPlugin)
	if strings.ToLower(installPluginsForce) == "true" || installPluginsVal == "" {
		return pluginsToInstall
	}
	installPluginsEntries := strings.Split(installPluginsVal, ",")

	// Format 1: ID only (e.g., "grafana-clock-panel")
	// Format 2: ID with version (e.g., "grafana-clock-panel 1.0.1")
	// Format 3: URL with folder (e.g., "https://grafana.com/api/plugins/grafana-clock-panel/versions/latest/download;grafana-clock-panel")
	pluginRegex := regexp.MustCompile(`(?:([^;]+);)?([^;\s]+)(?:\s+(.+))?`)
	for _, entry := range installPluginsEntries {
		trimmedEntry := strings.TrimSpace(entry)
		if trimmedEntry == "" {
			continue
		}

		matches := pluginRegex.FindStringSubmatch(trimmedEntry)

		if matches == nil {
			// No match found at all, skip this entry
			continue
		}

		url := ""
		if len(matches) > 1 {
			url = strings.TrimSpace(matches[1])
		}

		id := ""
		if len(matches) > 2 {
			id = strings.TrimSpace(matches[2])
		}
		if _, exists := preinstallPlugins[id]; exists {
			continue
		}

		version := ""
		if len(matches) > 3 {
			version = strings.TrimSpace(matches[3])
		}
		if id != "" {
			pluginsToInstall[id] = InstallPlugin{ID: id, Version: version, URL: url}
		}
	}
	return pluginsToInstall
}

func (cfg *Cfg) readPluginSettings(iniFile *ini.File) error {
	pluginsSection := iniFile.Section("plugins")

	cfg.PluginsEnableAlpha = pluginsSection.Key("enable_alpha").MustBool(false)
	cfg.PluginsAppsSkipVerifyTLS = pluginsSection.Key("app_tls_skip_verify_insecure").MustBool(false)
	cfg.PluginSettings = extractPluginSettings(iniFile.Sections())
	cfg.PluginSkipPublicKeyDownload = pluginsSection.Key("public_key_retrieval_disabled").MustBool(false)
	cfg.PluginForcePublicKeyDownload = pluginsSection.Key("public_key_retrieval_on_startup").MustBool(false)

	cfg.PluginsAllowUnsigned = util.SplitString(pluginsSection.Key("allow_loading_unsigned_plugins").MustString(""))
	cfg.DisablePlugins = util.SplitString(pluginsSection.Key("disable_plugins").MustString(""))
	cfg.HideAngularDeprecation = util.SplitString(pluginsSection.Key("hide_angular_deprecation").MustString(""))
	cfg.ForwardHostEnvVars = util.SplitString(pluginsSection.Key("forward_host_env_vars").MustString(""))
	disablePreinstall := pluginsSection.Key("preinstall_disabled").MustBool(false)
	if !disablePreinstall {
		rawInstallPlugins := util.SplitString(pluginsSection.Key("preinstall").MustString(""))
		preinstallPlugins := make(map[string]InstallPlugin)

		// Add the default preinstalled plugins
		for _, plugin := range defaultPreinstallPlugins {
			preinstallPlugins[plugin.ID] = plugin
		}
		if cfg.IsFeatureToggleEnabled("grafanaAdvisor") { // Use literal string to avoid circular dependency
			preinstallPlugins["grafana-advisor-app"] = InstallPlugin{ID: "grafana-advisor-app"}
		}
		// Add the plugins defined in the configuration
		for _, plugin := range rawInstallPlugins {
			parts := strings.Split(plugin, "@")
			id := parts[0]
			version := ""
			url := ""
			if len(parts) > 1 {
				version = parts[1]
				if len(parts) > 2 {
					url = parts[2]
				}
			}

			preinstallPlugins[id] = InstallPlugin{ID: id, Version: version, URL: url}
		}
		legacyInstallPlugins := cfg.processLegacyInstallPlugins(preinstallPlugins, os.Getenv("GF_INSTALL_PLUGINS"), os.Getenv("GF_INSTALL_PLUGINS_FORCE"))
		// Remove from the list the plugins that have been disabled
		for _, disabledPlugin := range cfg.DisablePlugins {
			delete(preinstallPlugins, disabledPlugin)
			delete(legacyInstallPlugins, disabledPlugin)
		}

		for _, plugin := range preinstallPlugins {
			cfg.PreinstallPlugins = append(cfg.PreinstallPlugins, plugin)
		}
		for _, plugin := range legacyInstallPlugins {
			cfg.LegacyInstallPlugins = append(cfg.LegacyInstallPlugins, plugin)
		}
		cfg.PreinstallPluginsAsync = pluginsSection.Key("preinstall_async").MustBool(true)
	}

	cfg.PluginCatalogURL = pluginsSection.Key("plugin_catalog_url").MustString("https://grafana.com/grafana/plugins/")
	cfg.PluginAdminEnabled = pluginsSection.Key("plugin_admin_enabled").MustBool(true)
	cfg.PluginAdminExternalManageEnabled = pluginsSection.Key("plugin_admin_external_manage_enabled").MustBool(false)
	cfg.PluginCatalogHiddenPlugins = util.SplitString(pluginsSection.Key("plugin_catalog_hidden_plugins").MustString(""))

	// Pull disabled plugins from the catalog
	cfg.PluginCatalogHiddenPlugins = append(cfg.PluginCatalogHiddenPlugins, cfg.DisablePlugins...)

	// Plugins CDN settings
	cfg.PluginsCDNURLTemplate = strings.TrimRight(pluginsSection.Key("cdn_base_url").MustString(""), "/")
	cfg.PluginLogBackendRequests = pluginsSection.Key("log_backend_requests").MustBool(false)

	cfg.PluginUpdateStrategy = pluginsSection.Key("update_strategy").In(PluginUpdateStrategyLatest, []string{PluginUpdateStrategyLatest, PluginUpdateStrategyMinor})

	return nil
}

package setting

import (
	"strings"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
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
		"grafana-lokiexplore-app":      {"grafana-lokiexplore-app", "", ""},
		"grafana-pyroscope-app":        {"grafana-pyroscope-app", "", ""},
		"grafana-exploretraces-app":    {"grafana-exploretraces-app", "", ""},
		"grafana-metricsdrilldown-app": {"grafana-metricsdrilldown-app", "", ""},
	}
)

// migrateInstallPluginsToPreinstall populates cfg:plugins.preinstall
// if cfg:plugins.preinstall is empty and GF_INSTALL_PLUGINS is set
func (cfg *Cfg) migrateInstallPluginsToPreinstall(iniFile *ini.File, installPluginsVal string) {
	if installPluginsVal == "" {
		return
	}
	pluginsSection := iniFile.Section("plugins")
	preinstall := pluginsSection.Key("preinstall").MustString("")
	if preinstall != "" {
		return
	}
	installPluginsEntries := strings.Split(installPluginsVal, ",")
	var convertedPreinstallEntries []string
	for _, entry := range installPluginsEntries {
		trimmedEntry := strings.TrimSpace(entry)
		if trimmedEntry == "" {
			continue
		}

		var convertedEntry string
		// value contains url and folder - https://grafana.com/grafana/plugins/grafana-piechart-panel/;grafana-piechart-panel
		if strings.Contains(trimmedEntry, ";") {
			parts := strings.SplitN(trimmedEntry, ";", 2)
			url := strings.TrimSpace(parts[0])
			folder := strings.TrimSpace(parts[1])
			if folder != "" && url != "" {
				convertedEntry = folder + "@@" + url
			}
		} else {
			// value contains id and version or just id - grafana-piechart-panel 7.0.0 or grafana-piechart-panel
			fields := strings.Fields(trimmedEntry) // Splits by whitespace
			if len(fields) > 0 {
				id := fields[0]
				if len(fields) > 1 {
					version := strings.Join(fields[1:], " ")
					convertedEntry = id + "@" + version
				} else {
					convertedEntry = id
				}
			}
		}

		if convertedEntry != "" {
			convertedPreinstallEntries = append(convertedPreinstallEntries, convertedEntry)
		}
	}
	pluginsSection.Key("preinstall").SetValue(strings.Join(convertedPreinstallEntries, ","))
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
			preinstallPlugins["grafana-advisor-app"] = InstallPlugin{"grafana-advisor-app", "", ""}
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

			preinstallPlugins[id] = InstallPlugin{id, version, url}
		}
		// Remove from the list the plugins that have been disabled
		for _, disabledPlugin := range cfg.DisablePlugins {
			delete(preinstallPlugins, disabledPlugin)
		}
		for _, plugin := range preinstallPlugins {
			cfg.PreinstallPlugins = append(cfg.PreinstallPlugins, plugin)
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

	return nil
}

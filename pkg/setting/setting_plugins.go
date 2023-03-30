package setting

import (
	"strings"

	"gopkg.in/ini.v1"
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

func (cfg *Cfg) readPluginSettings(iniFile *ini.File) error {
	pluginsSection := iniFile.Section("plugins")

	cfg.PluginsEnableAlpha = pluginsSection.Key("enable_alpha").MustBool(false)
	cfg.PluginsAppsSkipVerifyTLS = pluginsSection.Key("app_tls_skip_verify_insecure").MustBool(false)
	cfg.PluginSettings = extractPluginSettings(iniFile.Sections())

	pluginsAllowUnsigned := pluginsSection.Key("allow_loading_unsigned_plugins").MustString("")

	for _, plug := range strings.Split(pluginsAllowUnsigned, ",") {
		plug = strings.TrimSpace(plug)
		cfg.PluginsAllowUnsigned = append(cfg.PluginsAllowUnsigned, plug)
	}

	cfg.PluginCatalogURL = pluginsSection.Key("plugin_catalog_url").MustString("https://grafana.com/grafana/plugins/")
	cfg.PluginAdminEnabled = pluginsSection.Key("plugin_admin_enabled").MustBool(true)
	cfg.PluginAdminExternalManageEnabled = pluginsSection.Key("plugin_admin_external_manage_enabled").MustBool(false)
	catalogHiddenPlugins := pluginsSection.Key("plugin_catalog_hidden_plugins").MustString("")

	for _, plug := range strings.Split(catalogHiddenPlugins, ",") {
		plug = strings.TrimSpace(plug)
		cfg.PluginCatalogHiddenPlugins = append(cfg.PluginCatalogHiddenPlugins, plug)
	}

	// Plugin extensions
	testExtensions := pluginsSection.Key("plugin_extensions_test_enabled").MustString("")
	for _, pointId := range strings.Split(testExtensions, ",") {
		pointId = strings.TrimSpace(pointId)
		cfg.PluginExtensionsTestEnabled = append(cfg.PluginExtensionsTestEnabled, pointId)
	}

	// Plugins CDN settings
	cfg.PluginsCDNURLTemplate = strings.TrimRight(pluginsSection.Key("cdn_base_url").MustString(""), "/")
	cfg.PluginLogBackendRequests = pluginsSection.Key("log_backend_requests").MustBool(false)

	return nil
}

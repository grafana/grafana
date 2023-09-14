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
	cfg.PluginSkipPublicKeyDownload = pluginsSection.Key("public_key_retrieval_disabled").MustBool(false)
	cfg.PluginForcePublicKeyDownload = pluginsSection.Key("public_key_retrieval_on_startup").MustBool(false)

	pluginsAllowUnsigned := pluginsSection.Key("allow_loading_unsigned_plugins").MustString("")

	for _, plug := range strings.Split(pluginsAllowUnsigned, ",") {
		plug = strings.TrimSpace(plug)
		cfg.PluginsAllowUnsigned = append(cfg.PluginsAllowUnsigned, plug)
	}

	disablePlugins := pluginsSection.Key("disable_plugins").MustString("")
	for _, plug := range strings.Split(disablePlugins, ",") {
		plug = strings.TrimSpace(plug)
		if plug != "" {
			cfg.DisablePlugins = append(cfg.DisablePlugins, plug)
		}
	}

	cfg.PluginCatalogURL = pluginsSection.Key("plugin_catalog_url").MustString("https://grafana.com/grafana/plugins/")
	cfg.PluginAdminEnabled = pluginsSection.Key("plugin_admin_enabled").MustBool(true)
	cfg.PluginAdminExternalManageEnabled = pluginsSection.Key("plugin_admin_external_manage_enabled").MustBool(false)
	catalogHiddenPlugins := pluginsSection.Key("plugin_catalog_hidden_plugins").MustString("")

	for _, plug := range strings.Split(catalogHiddenPlugins, ",") {
		plug = strings.TrimSpace(plug)
		cfg.PluginCatalogHiddenPlugins = append(cfg.PluginCatalogHiddenPlugins, plug)
	}
	// Pull disablep plugins from the catalog
	cfg.PluginCatalogHiddenPlugins = append(cfg.PluginCatalogHiddenPlugins, cfg.DisablePlugins...)

	// Plugins CDN settings
	cfg.PluginsCDNURLTemplate = strings.TrimRight(pluginsSection.Key("cdn_base_url").MustString(""), "/")
	cfg.PluginLogBackendRequests = pluginsSection.Key("log_backend_requests").MustBool(false)

	return nil
}

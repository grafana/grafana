package setting

import (
	"strings"

	"gopkg.in/ini.v1"
)

func (cfg *Cfg) readPluginSettings(iniFile *ini.File) error {
	pluginsSection := iniFile.Section("plugins")
	cfg.PluginsEnableAlpha = pluginsSection.Key("enable_alpha").MustBool(false)
	cfg.PluginsAppsSkipVerifyTLS = pluginsSection.Key("app_tls_skip_verify_insecure").MustBool(false)
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
	return nil
}

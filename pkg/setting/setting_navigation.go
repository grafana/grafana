package setting

import (
	"strings"
)

func (cfg *Cfg) readNavigationSettings() error {
	sec := cfg.Raw.Section("navigation")
	cfg.PluginAppNavIds = map[string]string{
		"grafana-k8s-app":                  "monitoring",
		"grafana-synthetic-monitoring-app": "monitoring",
	}

	for _, key := range sec.Keys() {
		if strings.HasPrefix(key.Name(), "app_nav_id_") {
			pluginId := strings.Replace(key.Name(), "app_nav_id_", "", 1)
			cfg.PluginAppNavIds[pluginId] = sec.Key(key.Name()).MustString("")
		}
	}

	return nil
}

package setting

import (
	"strings"
)

func (cfg *Cfg) readNavigationSettings() error {
	sec := cfg.Raw.Section("navigation")
	cfg.NavigationAppNavIds = map[string]string{
		"grafana-k8s-app":                  "monitoring",
		"grafana-synthetic-monitoring-app": "monitoring",
		"grafana-ml-app":                   "alerts-and-incidents",
		"grafana-incident-app":             "alerts-and-incidents",
	}

	cfg.NavigationNavIdOverrides = map[string]string{
		"/a/myorgid-simple-app/catalog": "admin",
	}

	for _, key := range sec.Keys() {
		if strings.HasPrefix(key.Name(), "nav_id_") {
			pluginId := strings.Replace(key.Name(), "nav_id_", "", 1)
			cfg.NavigationAppNavIds[pluginId] = sec.Key(key.Name()).MustString("")
		}
	}

	return nil
}

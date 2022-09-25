package setting

import (
	"strconv"
	"strings"
)

type NavigationAppConfig struct {
	SectionID  string
	SortWeight int64
}

func (cfg *Cfg) readNavigationSettings() {
	sec := cfg.Raw.Section("navigation.apps")
	cfg.NavigationAppConfig = map[string]NavigationAppConfig{
		"grafana-k8s-app":                  {SectionID: "monitoring", SortWeight: 1},
		"grafana-synthetic-monitoring-app": {SectionID: "monitoring", SortWeight: 2},
		"grafana-ml-app":                   {SectionID: "alerts-and-incidents"},
		"grafana-incident-app":             {SectionID: "alerts-and-incidents"},
	}

	cfg.NavigationAppPathConfig = map[string]NavigationAppConfig{
		"/a/myorgid-simple-app/catalog": {SectionID: "cfg"},
	}

	for _, key := range sec.Keys() {
		if strings.HasPrefix(key.Name(), "nav_id_") {
			pluginId := strings.Replace(key.Name(), "nav_id_", "", 1)
			// Support <id> <weight> value
			values := strings.Split(sec.Key(key.Name()).MustString(""), " ")

			appCfg := &NavigationAppConfig{SectionID: values[0]}
			if len(values) > 1 {
				if weight, err := strconv.ParseInt(values[1], 10, 64); err == nil {
					appCfg.SortWeight = weight
				}
			}

			cfg.NavigationAppConfig[pluginId] = *appCfg
		}
	}
}

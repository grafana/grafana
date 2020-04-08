package backendplugin

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

type pluginSettings map[string]string

func (ps pluginSettings) ToEnv(prefix string, hostEnv []string) []string {
	env := []string{}
	for k, v := range ps {
		env = append(env, fmt.Sprintf("%s_%s=%s", prefix, strings.ToUpper(k), v))
	}

	env = append(env, hostEnv...)

	return env
}

func extractPluginSettings(cfg *setting.Cfg) map[string]pluginSettings {
	pluginSettings := map[string]pluginSettings{}
	for _, section := range cfg.Raw.Sections() {
		sectionName := section.Name()
		if !strings.HasPrefix(sectionName, "plugin.") {
			continue
		}

		pluginID := strings.Replace(sectionName, "plugin.", "", 1)
		settings := map[string]string{}
		for k, v := range section.KeysHash() {
			if k == "path" || strings.ToLower(k) == "id" {
				continue
			}

			settings[k] = v
		}

		pluginSettings[pluginID] = settings
	}

	return pluginSettings
}

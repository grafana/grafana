package manager

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

func getPluginSettings(plugID string, cfg *setting.Cfg) pluginSettings {
	ps := pluginSettings{}
	for k, v := range cfg.PluginSettings[plugID] {
		if k == "path" || strings.ToLower(k) == "id" {
			continue
		}

		ps[k] = v
	}

	return ps
}

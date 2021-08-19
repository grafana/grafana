package manager

import (
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

type pluginSettings map[string]string

func (ps pluginSettings) ToEnv(prefix string, hostEnv []string) []string {
	var env []string
	for k, v := range ps {
		key := fmt.Sprintf("%s_%s", prefix, strings.ToUpper(k))
		if value := os.Getenv(key); value != "" {
			v = value
		}

		env = append(env, fmt.Sprintf("%s=%s", key, v))
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

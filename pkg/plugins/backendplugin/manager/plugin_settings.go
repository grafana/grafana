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
		v = checkForOverrides(key, v)

		env = append(env, fmt.Sprintf("%s_%s=%s", prefix, strings.ToUpper(k), v))
	}

	env = append(env, hostEnv...)

	return env
}

func checkForOverrides(key string, v string) string {
	if value := os.Getenv(key); value != "" {
		v = value
	}
	return v
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

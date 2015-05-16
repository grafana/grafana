package api

import (
	"strings"

	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
)

func AdminGetSettings(c *middleware.Context) {
	settings := make(map[string]interface{})

	for _, section := range setting.Cfg.Sections() {
		jsonSec := make(map[string]interface{})
		settings[section.Name()] = jsonSec

		for _, key := range section.Keys() {
			keyName := key.Name()
			value := key.Value()
			if strings.Contains(keyName, "secret") || strings.Contains(keyName, "password") || (strings.Contains(keyName, "provider_config") && strings.Contains(value, "@")) {
				value = "************"
			}

			jsonSec[keyName] = value
		}
	}

	c.JSON(200, settings)
}

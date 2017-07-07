package api

import (
	"strings"

	"github.com/wangy1931/grafana/pkg/bus"
	"github.com/wangy1931/grafana/pkg/middleware"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/setting"
)

func AdminGetSettings(c *middleware.Context) {
	settings := make(map[string]interface{})

	for _, section := range setting.Cfg.Sections() {
		jsonSec := make(map[string]interface{})
		settings[section.Name()] = jsonSec

		for _, key := range section.Keys() {
			keyName := key.Name()
			value := key.Value()
			if strings.Contains(keyName, "secret") || strings.Contains(keyName, "password") || (strings.Contains(keyName, "provider_config")) {
				value = "************"
			}

			jsonSec[keyName] = value
		}
	}

	c.JSON(200, settings)
}

func AdminGetStats(c *middleware.Context) {

	statsQuery := m.GetAdminStatsQuery{}

	if err := bus.Dispatch(&statsQuery); err != nil {
		c.JsonApiErr(500, "Failed to get admin stats from database", err)
		return
	}

	c.JSON(200, statsQuery.Result)
}

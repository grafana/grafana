package middleware

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func ReqAppRoles(c *models.ReqContext) {
	pluginID := c.Params("id")

	plugin, exists := plugins.Plugins[pluginID]
	if !exists {
		return
	}

	if len(plugin.Includes) == 0 {
		return
	}

	ok := false
	for _, include := range plugin.Includes {
		if !strings.Contains(c.Req.RequestURI, include.Path) {
			continue
		}

		if c.OrgRole.Includes(include.Role) {
			ok = true
			break
		}
	}

	if !ok {
		c.Redirect(setting.AppSubUrl + "/")
	}
}

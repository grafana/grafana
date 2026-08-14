package api

import (
	"errors"
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/web"
)

func checkAppEnabled(pluginStore pluginstore.Store, pluginSettings pluginsettings.Service) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		pluginID := web.Params(c.Req)[":pluginId"]
		p, exists := pluginStore.Plugin(c.Req.Context(), pluginID)
		if !exists {
			c.JsonApiErr(http.StatusNotFound, "Plugin not found", nil)
			return
		}
		if !p.IsApp() {
			return
		}

		ps, err := pluginSettings.GetPluginSettingByPluginID(c.Req.Context(), &pluginsettings.GetByPluginIDArgs{
			OrgID:    c.OrgID,
			PluginID: pluginID,
		})
		if err != nil {
			if errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
				// If the plugin is auto enabled, we don't want to return an error because auto enabling allows us
				// to enable plugins that are not explicitly configured.
				if p.AutoEnabled {
					return
				}

				c.JsonApiErr(http.StatusNotFound, "Plugin setting not found", nil)
				return
			}
			c.JsonApiErr(http.StatusInternalServerError, "Failed to get plugin settings", err)
			return
		}

		if !ps.Enabled {
			c.JsonApiErr(http.StatusNotFound, "Plugin is not enabled", nil)
			return
		}
	}
}

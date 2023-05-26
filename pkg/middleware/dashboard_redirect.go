package middleware

import (
	"fmt"
	"strings"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
)

// In Grafana v7.0 we changed panel edit & view query parameters.
// This middleware tries to detect those old url parameters and direct to the new url query params
func RedirectFromLegacyPanelEditURL(cfg *setting.Cfg) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		queryParams := c.Req.URL.Query()

		panelID, hasPanelID := queryParams["panelId"]
		_, hasFullscreen := queryParams["fullscreen"]
		_, hasEdit := queryParams["edit"]

		if hasPanelID && hasFullscreen {
			delete(queryParams, "panelId")
			delete(queryParams, "fullscreen")
			delete(queryParams, "edit")

			if hasEdit {
				queryParams["editPanel"] = panelID
			} else {
				queryParams["viewPanel"] = panelID
			}

			newURL := fmt.Sprintf("%s%s?%s", cfg.AppURL, strings.TrimPrefix(c.Req.URL.Path, "/"), queryParams.Encode())
			c.Redirect(newURL, 301)
		}
	}
}

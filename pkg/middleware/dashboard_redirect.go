package middleware

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func getDashboardURLBySlug(orgID int64, slug string) (string, error) {
	// TODO: Drop bus call
	query := models.GetDashboardQuery{Slug: slug, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		return "", models.ErrDashboardNotFound
	}

	return models.GetDashboardUrl(query.Result.Uid, query.Result.Slug), nil
}

func RedirectFromLegacyDashboardURL() func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		slug := c.Params("slug")

		if slug != "" {
			if url, err := getDashboardURLBySlug(c.OrgId, slug); err == nil {
				url = fmt.Sprintf("%s?%s", url, c.Req.URL.RawQuery)
				c.Redirect(url, 301)
				return
			}
		}
	}
}

// In Grafana v7.0 we changed panel edit & view query parameters.
// This middleware tries to detect those old url parameters and direct to the new url query params
func RedirectFromLegacyPanelEditURL(cfg *setting.Cfg) func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
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

func RedirectFromLegacyDashboardSoloURL(cfg *setting.Cfg) func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		slug := c.Params("slug")
		renderRequest := c.QueryBool("render")

		if slug != "" {
			url, err := getDashboardURLBySlug(c.OrgId, slug)
			if err != nil {
				return
			}

			if renderRequest && strings.Contains(url, cfg.AppSubURL) {
				url = strings.Replace(url, cfg.AppSubURL, "", 1)
			}

			url = strings.Replace(url, "/d/", "/d-solo/", 1)
			url = fmt.Sprintf("%s?%s", url, c.Req.URL.RawQuery)
			c.Redirect(url, 301)
			return
		}
	}
}

package middleware

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"gopkg.in/macaron.v1"
)

func (s *MiddlewareService) getDashboardURLBySlug(orgID int64, slug string) (string, error) {
	// TODO: Drop bus call
	query := models.GetDashboardQuery{Slug: slug, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		return "", models.ErrDashboardNotFound
	}

	return models.GetDashboardUrl(query.Result.Uid, query.Result.Slug), nil
}

func (s *MiddlewareService) RedirectFromLegacyDashboardURL() macaron.Handler {
	return func(c *models.ReqContext) {
		slug := c.Params("slug")

		if slug != "" {
			if url, err := s.getDashboardURLBySlug(c.OrgId, slug); err == nil {
				url = fmt.Sprintf("%s?%s", url, c.Req.URL.RawQuery)
				c.Redirect(url, 301)
				return
			}
		}
	}
}

// RedirectFromLegacyPanelEditURL handles redirects from legacy panel edit URLs.
// In Grafana v7.0 we changed panel edit & view query parameters.
// This middleware tries to detect those old url parameters and direct to the new url query params
func (s *MiddlewareService) RedirectFromLegacyPanelEditURL(c *models.ReqContext) {
	queryParams := c.Req.URL.Query()

	panelId, hasPanelId := queryParams["panelId"]
	_, hasFullscreen := queryParams["fullscreen"]
	_, hasEdit := queryParams["edit"]

	if hasPanelId && hasFullscreen {
		delete(queryParams, "panelId")
		delete(queryParams, "fullscreen")
		delete(queryParams, "edit")

		if hasEdit {
			queryParams["editPanel"] = panelId
		} else {
			queryParams["viewPanel"] = panelId
		}

		newURL := fmt.Sprintf("%s%s?%s", s.Cfg.AppURL, strings.TrimPrefix(c.Req.URL.Path, "/"), queryParams.Encode())
		c.Redirect(newURL, 301)
	}
}

func (s *MiddlewareService) RedirectFromLegacyDashboardSoloURL(c *models.ReqContext) {
	slug := c.Params("slug")
	renderRequest := c.QueryBool("render")

	if slug != "" {
		if url, err := s.getDashboardURLBySlug(c.OrgId, slug); err == nil {
			if renderRequest && strings.Contains(url, s.Cfg.AppSubURL) {
				url = strings.Replace(url, s.Cfg.AppSubURL, "", 1)
			}

			url = strings.Replace(url, "/d/", "/d-solo/", 1)
			url = fmt.Sprintf("%s?%s", url, c.Req.URL.RawQuery)
			c.Redirect(url, 301)
			return
		}
	}
}

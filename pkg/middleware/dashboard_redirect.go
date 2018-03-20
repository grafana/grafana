package middleware

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

func getDashboardUrlBySlug(orgId int64, slug string) (string, error) {
	query := m.GetDashboardQuery{Slug: slug, OrgId: orgId}

	if err := bus.Dispatch(&query); err != nil {
		return "", m.ErrDashboardNotFound
	}

	return m.GetDashboardUrl(query.Result.Uid, query.Result.Slug), nil
}

func RedirectFromLegacyDashboardUrl() macaron.Handler {
	return func(c *m.ReqContext) {
		slug := c.Params("slug")

		if slug != "" {
			if url, err := getDashboardUrlBySlug(c.OrgId, slug); err == nil {
				url = fmt.Sprintf("%s?%s", url, c.Req.URL.RawQuery)
				c.Redirect(url, 301)
				return
			}
		}
	}
}

func RedirectFromLegacyDashboardSoloUrl() macaron.Handler {
	return func(c *m.ReqContext) {
		slug := c.Params("slug")
		renderRequest := c.QueryBool("render")

		if slug != "" {
			if url, err := getDashboardUrlBySlug(c.OrgId, slug); err == nil {
				if renderRequest && strings.Contains(url, setting.AppSubUrl) {
					url = strings.Replace(url, setting.AppSubUrl, "", 1)
				}

				url = strings.Replace(url, "/d/", "/d-solo/", 1)
				url = fmt.Sprintf("%s?%s", url, c.Req.URL.RawQuery)
				c.Redirect(url, 301)
				return
			}
		}
	}
}

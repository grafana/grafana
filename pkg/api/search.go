package api

import (
	"regexp"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

func Search(c *middleware.Context) {
	queryText := c.Query("q")
	starred := c.Query("starred")

	result := m.SearchResult{
		Dashboards: []*m.DashboardSearchHit{},
		Tags:       []*m.DashboardTagCloudItem{},
	}

	if strings.HasPrefix(queryText, "tags!:") {
		query := m.GetDashboardTagsQuery{AccountId: c.AccountId}
		err := bus.Dispatch(&query)
		if err != nil {
			c.JsonApiErr(500, "Failed to get tags from database", err)
			return
		}
		result.Tags = query.Result
		result.TagsOnly = true
	} else {
		searchQueryRegEx, _ := regexp.Compile(`(tags:(\w*)\sAND\s)?(?:title:)?(.*)?`)
		matches := searchQueryRegEx.FindStringSubmatch(queryText)
		query := m.SearchDashboardsQuery{
			Title:     matches[3],
			Tag:       matches[2],
			UserId:    c.UserId,
			IsStarred: starred == "1",
			AccountId: c.AccountId,
		}
		err := bus.Dispatch(&query)
		if err != nil {
			c.JsonApiErr(500, "Search failed", err)
			return
		}

		result.Dashboards = query.Result
		for _, dash := range result.Dashboards {
			dash.Url = setting.AbsUrlTo("dashboard/db/" + dash.Slug)
		}
	}

	c.JSON(200, result)
}

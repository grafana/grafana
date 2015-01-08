package api

import (
	"regexp"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func Search(c *middleware.Context) {
	queryText := c.Query("q")
	result := m.SearchResult{
		Dashboards: []*m.DashboardSearchHit{},
		Tags:       []*m.DashboardTagCloudItem{},
	}

	if strings.HasPrefix(queryText, "tags!:") {
		query := m.GetDashboardTagsQuery{}
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
			AccountId: c.GetAccountId(),
		}
		err := bus.Dispatch(&query)
		if err != nil {
			c.JsonApiErr(500, "Search failed", err)
			return
		}
		result.Dashboards = query.Result
	}

	c.JSON(200, result)
}

package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func Search(c *middleware.Context) {
	query := c.Query("query")
	tag := c.Query("tag")
	tagcloud := c.Query("tagcloud")
	starred := c.Query("starred")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 200
	}

	result := m.SearchResult{
		Dashboards: []*m.DashboardSearchHit{},
		Tags:       []*m.DashboardTagCloudItem{},
	}

	if tagcloud == "true" {

		query := m.GetDashboardTagsQuery{OrgId: c.OrgId}
		err := bus.Dispatch(&query)
		if err != nil {
			c.JsonApiErr(500, "Failed to get tags from database", err)
			return
		}
		result.Tags = query.Result
		result.TagsOnly = true

	} else {

		query := search.Query{
			Title:     query,
			Tag:       tag,
			UserId:    c.UserId,
			Limit:     limit,
			IsStarred: starred == "true",
			OrgId:     c.OrgId,
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

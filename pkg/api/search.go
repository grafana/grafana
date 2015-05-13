package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/search"
)

func Search(c *middleware.Context) {
	query := c.Query("query")
	tag := c.Query("tag")
	starred := c.Query("starred")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 200
	}

	searchQuery := search.Query{
		Title:     query,
		Tag:       tag,
		UserId:    c.UserId,
		Limit:     limit,
		IsStarred: starred == "true",
		OrgId:     c.OrgId,
	}

	err := bus.Dispatch(&searchQuery)
	if err != nil {
		c.JsonApiErr(500, "Search failed", err)
		return
	}

	c.JSON(200, searchQuery.Result)
}

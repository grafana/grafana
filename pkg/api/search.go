package api

import (
	"strconv"

	"github.com/wangy1931/grafana/pkg/bus"
	"github.com/wangy1931/grafana/pkg/middleware"
	"github.com/wangy1931/grafana/pkg/services/search"
	m "github.com/wangy1931/grafana/pkg/models"
)

func Search(c *middleware.Context) {
	query := c.Query("query")
	tags := c.QueryStrings("tag")
	starred := c.Query("starred")
	limit := c.QueryInt("limit")

	if limit == 0 {
		limit = 1000
	}

	dbids := make([]int, 0)
	for _, id := range c.QueryStrings("dashboardIds") {
		dashboardId, err := strconv.Atoi(id)
		if err == nil {
			dbids = append(dbids, dashboardId)
		}
	}

	searchQuery := search.Query{
		Title:        query,
		Tags:         tags,
		UserId:       c.UserId,
		Limit:        limit,
		IsStarred:    starred == "true",
		OrgId:        c.OrgId,
		DashboardIds: dbids,
	}

	err := bus.Dispatch(&searchQuery)
	if err != nil {
		c.JsonApiErr(500, "Search failed", err)
		return
	}

	dashQuery := m.GetCurrentSystemDashboards{}
	dashQuery.SystemId = c.SystemId
	HitList := make([]*search.Hit, 0)
	err = bus.Dispatch(&dashQuery)
	if err != nil {
		c.JsonApiErr(500, "Get Dasboard Id failed", err)
		return
	}

	for _, hit := range searchQuery.Result {
		for _, dash := range dashQuery.Result {
			if (dash.DashboardId == hit.Id) {
				HitList = append(HitList, hit);
			}
		}
	}
	c.JSON(200, HitList)
}

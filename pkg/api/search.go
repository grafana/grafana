package api

import (
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

	searchQuery := search.Query{
		Title:     query,
		Tags:      tags,
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

  dashQuery := m.GetCurrentDashboardDashboard{}
  dashQuery.UserId = c.UserId
  err = bus.Dispatch(&dashQuery)
  if err != nil {
    c.JsonApiErr(500, "Get Dasboard Id failed", err)
    return
  }

  if(c.OrgRole!="Admin" || !c.IsGrafanaAdmin) {
    for index, hit := range searchQuery.Result {
      isDelete := true
      for _, dash := range dashQuery.Result {
        if (dash.Id == hit.Id) {
          isDelete = false;
        }
      }
      if (isDelete) {
        last := index + 1
        if (last > len(searchQuery.Result)) {
          last = len(searchQuery.Result)
        }
        searchQuery.Result = append(searchQuery.Result[:index], searchQuery.Result[last:]...)
      }
    }
  }
	c.JSON(200, searchQuery.Result)
}

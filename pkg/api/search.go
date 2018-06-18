package api

import (
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func Search(c *m.ReqContext) {
	query := c.Query("query")
	tags := c.QueryStrings("tag")
	starred := c.Query("starred")
	limit := c.QueryInt("limit")
	dashboardType := c.Query("type")
	permission := m.PERMISSION_VIEW

	if limit == 0 {
		limit = 1000
	}

	if c.Query("permission") == "Edit" {
		permission = m.PERMISSION_EDIT
	}

	dbIDs := make([]int64, 0)
	for _, id := range c.QueryStrings("dashboardIds") {
		dashboardID, err := strconv.ParseInt(id, 10, 64)
		if err == nil {
			dbIDs = append(dbIDs, dashboardID)
		}
	}

	folderIDs := make([]int64, 0)
	for _, id := range c.QueryStrings("folderIds") {
		folderID, err := strconv.ParseInt(id, 10, 64)
		if err == nil {
			folderIDs = append(folderIDs, folderID)
		}
	}

	searchQuery := search.Query{
		Title:        query,
		Tags:         tags,
		SignedInUser: c.SignedInUser,
		Limit:        limit,
		IsStarred:    starred == "true",
		OrgId:        c.OrgId,
		DashboardIds: dbIDs,
		Type:         dashboardType,
		FolderIds:    folderIDs,
		Permission:   permission,
	}

	err := bus.Dispatch(&searchQuery)
	if err != nil {
		c.JsonApiErr(500, "Search failed", err)
		return
	}

	c.TimeRequest(metrics.M_Api_Dashboard_Search)
	c.JSON(200, searchQuery.Result)
}

package api

import (
	"github.com/grafana/grafana/pkg/util"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func Search(c *models.ReqContext) Response {
	query := c.Query("query")
	tags := c.QueryStrings("tag")
	starred := c.Query("starred")
	limit := c.QueryInt64("limit")
	page := c.QueryInt64("page")
	dashboardType := c.Query("type")
	sort := c.Query("sort")
	permission := models.PERMISSION_VIEW

	if limit > 5000 {
		return Error(422, "Limit is above maximum allowed (5000), use page parameter to access hits beyond limit", nil)
	}

	if c.Query("permission") == "Edit" {
		permission = models.PERMISSION_EDIT
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
		Page:         page,
		IsStarred:    starred == "true",
		OrgId:        c.OrgId,
		DashboardIds: dbIDs,
		Type:         dashboardType,
		FolderIds:    folderIDs,
		Permission:   permission,
		Sort:         sort,
	}

	err := bus.Dispatch(&searchQuery)
	if err != nil {
		return Error(500, "Search failed", err)
	}

	c.TimeRequest(metrics.MApiDashboardSearch)
	return JSON(200, searchQuery.Result)
}

func (hs *HTTPServer) ListSortOptions(c *models.ReqContext) Response {
	opts := hs.SearchService.SortOptions()

	res := []util.DynMap{}
	for _, o := range opts {
		res = append(res, util.DynMap{
			"name":        o.Name,
			"displayName": o.DisplayName,
			"description": o.Description,
		})
	}

	return JSON(http.StatusOK, util.DynMap{
		"sortOptions": res,
	})
}

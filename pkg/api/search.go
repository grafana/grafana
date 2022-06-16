package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) Search(c *models.ReqContext) response.Response {
	query := c.Query("query")
	tags := c.QueryStrings("tag")
	starred := c.Query("starred")
	limit := c.QueryInt64("limit")
	page := c.QueryInt64("page")
	dashboardType := c.Query("type")
	sort := c.Query("sort")
	permission := models.PERMISSION_VIEW

	if limit > 5000 {
		return response.Error(422, "Limit is above maximum allowed (5000), use page parameter to access hits beyond limit", nil)
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

	dbUIDs := c.QueryStrings("dashboardUID")

	folderIDs := make([]int64, 0)
	for _, id := range c.QueryStrings("folderIds") {
		folderID, err := strconv.ParseInt(id, 10, 64)
		if err == nil {
			folderIDs = append(folderIDs, folderID)
		}
	}

	if len(dbIDs) > 0 && len(dbUIDs) > 0 {
		return response.Error(400, "search supports UIDs or IDs, not both", nil)
	}

	searchQuery := search.Query{
		Title:         query,
		Tags:          tags,
		SignedInUser:  c.SignedInUser,
		Limit:         limit,
		Page:          page,
		IsStarred:     starred == "true",
		OrgId:         c.OrgId,
		DashboardIds:  dbIDs,
		DashboardUIDs: dbUIDs,
		Type:          dashboardType,
		FolderIds:     folderIDs,
		Permission:    permission,
		Sort:          sort,
	}

	err := hs.SearchService.SearchHandler(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
	}

	defer c.TimeRequest(metrics.MApiDashboardSearch)

	if !c.QueryBool("accesscontrol") {
		return response.JSON(http.StatusOK, searchQuery.Result)
	}

	return hs.searchHitsWithMetadata(c, searchQuery.Result)
}

func (hs *HTTPServer) searchHitsWithMetadata(c *models.ReqContext, hits models.HitList) response.Response {
	folderUIDs := make(map[string]bool)
	dashboardUIDs := make(map[string]bool)

	for _, hit := range hits {
		if hit.Type == models.DashHitFolder {
			folderUIDs[hit.UID] = true
		} else {
			dashboardUIDs[hit.UID] = true
			folderUIDs[hit.FolderUID] = true
		}
	}

	folderMeta := hs.getMultiAccessControlMetadata(c, c.OrgId, dashboards.ScopeFoldersPrefix, folderUIDs)
	dashboardMeta := hs.getMultiAccessControlMetadata(c, c.OrgId, dashboards.ScopeDashboardsPrefix, dashboardUIDs)

	// search hit with access control metadata attached
	type hitWithMeta struct {
		*models.Hit
		AccessControl accesscontrol.Metadata `json:"accessControl,omitempty"`
	}
	hitsWithMeta := make([]hitWithMeta, 0, len(hits))
	for _, hit := range hits {
		var meta accesscontrol.Metadata
		if hit.Type == models.DashHitFolder {
			meta = folderMeta[hit.UID]
		} else {
			meta = accesscontrol.MergeMeta("dashboards", dashboardMeta[hit.UID], folderMeta[hit.FolderUID])
		}
		hitsWithMeta = append(hitsWithMeta, hitWithMeta{hit, meta})
	}

	return response.JSON(http.StatusOK, hitsWithMeta)
}

func (hs *HTTPServer) ListSortOptions(c *models.ReqContext) response.Response {
	opts := hs.SearchService.SortOptions()

	res := []util.DynMap{}
	for _, o := range opts {
		res = append(res, util.DynMap{
			"name":        o.Name,
			"displayName": o.DisplayName,
			"description": o.Description,
			"meta":        o.MetaName,
		})
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"sortOptions": res,
	})
}

package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/util"
)

// swagger:route GET /search search search
//
// Responses:
// 200: searchResponse
// 401: unauthorisedError
// 422: unprocessableEntityError
// 500: internalServerError
func (hs *HTTPServer) Search(c *contextmodel.ReqContext) response.Response {
	query := c.Query("query")
	tags := c.QueryStrings("tag")
	starred := c.Query("starred")
	limit := c.QueryInt64("limit")
	page := c.QueryInt64("page")
	dashboardType := c.Query("type")
	sort := c.Query("sort")
	permission := dashboards.PERMISSION_VIEW

	if limit > 5000 {
		return response.Error(422, "Limit is above maximum allowed (5000), use page parameter to access hits beyond limit", nil)
	}

	if c.Query("permission") == "Edit" {
		permission = dashboards.PERMISSION_EDIT
	}

	dbIDs := make([]int64, 0)
	for _, id := range c.QueryStrings("dashboardIds") {
		dashboardID, err := strconv.ParseInt(id, 10, 64)
		if err == nil {
			dbIDs = append(dbIDs, dashboardID)
		}
	}

	dbUIDs := c.QueryStrings("dashboardUIDs")
	if len(dbUIDs) == 0 {
		// To keep it for now backward compatible for grafana 9
		dbUIDs = c.QueryStrings("dashboardUID")
	}

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
		OrgId:         c.OrgID,
		DashboardIds:  dbIDs,
		DashboardUIDs: dbUIDs,
		Type:          dashboardType,
		FolderIds:     folderIDs,
		Permission:    permission,
		Sort:          sort,
	}

	hits, err := hs.SearchService.SearchHandler(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(500, "Search failed", err)
	}

	defer c.TimeRequest(metrics.MApiDashboardSearch)

	return response.JSON(http.StatusOK, hits)
}

// swagger:route GET /search/sorting search listSortOptions
//
// List search sorting options.
//
// Responses:
// 200: listSortOptionsResponse
// 401: unauthorisedError
func (hs *HTTPServer) ListSortOptions(c *contextmodel.ReqContext) response.Response {
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

// swagger:parameters search
type SearchParams struct {
	// Search Query
	// in:query
	// required: false
	Query string `json:"query"`
	// List of tags to search for
	// in:query
	// required: false
	// type: array
	// collectionFormat: multi
	Tag []string `json:"tag"`
	// Type to search for, dash-folder or dash-db
	// in:query
	// required: false
	// Description:
	// * `dash-folder` - Search for folder
	// * `dash-db` - Seatch for dashboard
	// Enum: dash-folder,dash-db
	Type string `json:"type"`
	// List of dashboard id’s to search for
	// in:query
	// required: false
	DashboardIds []int64 `json:"dashboardIds"`
	// List of dashboard uid’s to search for
	// in:query
	// required: false
	DashboardUIDs []string `json:"dashboardUIDs"`
	// List of folder id’s to search in for dashboards
	// in:query
	// required: false
	FolderIds []int64 `json:"folderIds"`
	// Flag indicating if only starred Dashboards should be returned
	// in:query
	// required: false
	Starred bool `json:"starred"`
	// Limit the number of returned results (max 5000)
	// in:query
	// required: false
	Limit int64 `json:"limit"`
	// Use this parameter to access hits beyond limit. Numbering starts at 1. limit param acts as page size. Only available in Grafana v6.2+.
	// in:query
	// required: false
	Page int64 `json:"page"`
	// Set to `Edit` to return dashboards/folders that the user can edit
	// in:query
	// required: false
	// default:View
	// Enum: Edit,View
	Permission string `json:"permission"`
	// Sort method; for listing all the possible sort methods use the search sorting endpoint.
	// in:query
	// required: false
	// default: alpha-asc
	// Enum: alpha-asc,alpha-desc
	Sort string `json:"sort"`
}

// swagger:response searchResponse
type SearchResponse struct {
	// in: body
	Body model.HitList `json:"body"`
}

// swagger:response listSortOptionsResponse
type ListSortOptionsResponse struct {
	// in: body
	Body struct {
		Name        string `json:"name"`
		DisplayName string `json:"displayName"`
		Description string `json:"description"`
		Meta        string `json:"meta"`
	} `json:"body"`
}

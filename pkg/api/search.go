package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/services/org"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
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
	c, span := hs.injectSpan(c, "api.Search")
	defer span.End()

	query := c.Query("query")
	tags := c.QueryStrings("tag")
	starred := c.Query("starred")
	limit := c.QueryInt64("limit")
	page := c.QueryInt64("page")
	dashboardType := c.Query("type")
	sort := c.Query("sort")
	deleted := c.Query("deleted")
	permission := dashboardaccess.PERMISSION_VIEW

	if deleted == "true" && c.GetOrgRole() != org.RoleAdmin {
		return response.Error(http.StatusUnauthorized, "Unauthorized", nil)
	}

	if limit > 5000 {
		return response.Error(http.StatusUnprocessableEntity, "Limit is above maximum allowed (5000), use page parameter to access hits beyond limit", nil)
	}

	if c.Query("permission") == "Edit" {
		permission = dashboardaccess.PERMISSION_EDIT
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
			metrics.MFolderIDsAPICount.WithLabelValues(metrics.Search).Inc()
		}
	}

	folderUIDs := c.QueryStrings("folderUIDs")

	bothDashboardIds := len(dbIDs) > 0 && len(dbUIDs) > 0
	bothFolderIds := len(folderIDs) > 0 && len(folderUIDs) > 0

	if bothDashboardIds || bothFolderIds {
		return response.Error(http.StatusBadRequest, "search supports UIDs or IDs, not both", nil)
	}

	searchQuery := search.Query{
		Title:         query,
		Tags:          tags,
		SignedInUser:  c.SignedInUser,
		Limit:         limit,
		Page:          page,
		IsStarred:     starred == "true",
		IsDeleted:     deleted == "true",
		OrgId:         c.GetOrgID(),
		DashboardIds:  dbIDs,
		DashboardUIDs: dbUIDs,
		Type:          dashboardType,
		FolderIds:     folderIDs, // nolint:staticcheck
		FolderUIDs:    folderUIDs,
		Permission:    permission,
		Sort:          sort,
	}

	hits, err := hs.SearchService.SearchHandler(c.Req.Context(), &searchQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Search failed", err)
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
	// This is deprecated: users should use the `dashboardUIDs` query parameter instead
	// in:query
	// required: false
	// deprecated: true
	DashboardIds []int64 `json:"dashboardIds"`
	// List of dashboard uid’s to search for
	// in:query
	// required: false
	DashboardUIDs []string `json:"dashboardUIDs"`
	// List of folder id’s to search in for dashboards
	// If it's `0` then it will query for the top level folders
	// This is deprecated: users should use the `folderUIDs` query parameter instead
	// in:query
	// required: false
	// deprecated: true
	//
	// Deprecated: use FolderUIDs instead
	FolderIds []int64 `json:"folderIds"`
	// List of folder UID’s to search in for dashboards
	// If it's an empty string then it will query for the top level folders
	// in:query
	// required: false
	FolderUIDs []string `json:"folderUIDs"`
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
	// Flag indicating if only soft deleted Dashboards should be returned
	// in:query
	// required: false
	Deleted bool `json:"deleted"`
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

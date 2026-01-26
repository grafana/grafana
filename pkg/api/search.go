package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/star"
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

	// Check if we should delegate to K8s API
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchUI) {
		return hs.searchViaK8sAPI(c)
	}

	// Legacy path
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

// searchViaK8sAPI delegates search requests to the K8s API and transforms the response
func (hs *HTTPServer) searchViaK8sAPI(c *contextmodel.ReqContext) response.Response {
	user, err := identity.GetRequester(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusUnauthorized, "Unauthorized", err)
	}

	// Get Kubernetes REST client
	client, err := kubernetes.NewForConfig(hs.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create K8s client", err)
	}

	// Build namespace
	namespaceMapper := request.GetNamespaceMapper(hs.Cfg)
	namespace := namespaceMapper(user.GetOrgID())

	// Build request with query parameters
	restReq := client.RESTClient().Get().
		Prefix("apis", "dashboard.grafana.app", "v0alpha1").
		Namespace(namespace).
		Resource("search")

	// Transform and add query parameters
	hs.addLegacySearchParamsToK8sRequest(restReq, c)

	// Make request to K8s API
	result := restReq.Do(c.Req.Context())

	if err := result.Error(); err != nil {
		return response.Error(http.StatusInternalServerError, "K8s API request failed", err)
	}

	// Read response body
	body, err := result.Raw()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to read response", err)
	}

	// Parse K8s response
	var k8sResults dashboardv0alpha1.SearchResults
	if err := json.Unmarshal(body, &k8sResults); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to parse response", err)
	}

	// Transform K8s response to legacy format
	hits := hs.transformK8sSearchResultsToLegacy(k8sResults, c)

	defer c.TimeRequest(metrics.MApiDashboardSearch)

	return response.JSON(http.StatusOK, hits)
}

// addLegacySearchParamsToK8sRequest adds legacy search query parameters to K8s REST request
func (hs *HTTPServer) addLegacySearchParamsToK8sRequest(req *rest.Request, c *contextmodel.ReqContext) {
	// Basic query parameters
	if query := c.Query("query"); query != "" {
		req.Param("query", query)
	}

	// Type conversion: dash-db -> dashboard, dash-folder -> folder
	if dashboardType := c.Query("type"); dashboardType != "" {
		if dashboardType == "dash-db" {
			req.Param("type", "dashboard")
		} else if dashboardType == "dash-folder" {
			req.Param("type", "folder")
		} else {
			req.Param("type", dashboardType)
		}
	}

	// Tags
	for _, tag := range c.QueryStrings("tag") {
		req.Param("tag", tag)
	}

	// Folder UIDs
	for _, folderUID := range c.QueryStrings("folderUIDs") {
		req.Param("folder", folderUID)
	}

	// Dashboard UIDs (mapped to "name" parameter in K8s API)
	for _, dashboardUID := range c.QueryStrings("dashboardUIDs") {
		req.Param("name", dashboardUID)
	}

	// Handle deprecated folderIds - need to convert to UIDs
	// For now, we'll skip this as it requires a lookup
	// TODO: Add folder ID to UID conversion if needed

	// Handle deprecated dashboardIds - need to convert to UIDs
	// For now, we'll skip this as it requires a lookup
	// TODO: Add dashboard ID to UID conversion if needed

	// Permission
	if permission := c.Query("permission"); permission != "" {
		req.Param("permission", strings.ToLower(permission))
	}

	// Sort
	if sort := c.Query("sort"); sort != "" {
		req.Param("sort", sort)
	}

	// Limit
	if limit := c.Query("limit"); limit != "" {
		req.Param("limit", limit)
	}

	// Page -> offset conversion
	if page := c.QueryInt64("page"); page > 0 {
		limit := c.QueryInt64("limit")
		if limit == 0 {
			limit = 50 // default limit
		}
		offset := (page - 1) * limit
		req.Param("offset", strconv.FormatInt(offset, 10))
	}

	// Deleted flag
	if deleted := c.Query("deleted"); deleted == "true" {
		// K8s API doesn't have a deleted parameter, this will be handled differently
		// For now, we'll skip it and let the legacy path handle it
	}

	// Starred - handled separately via Collections API filtering
	// This will be filtered after getting results
}

// transformK8sSearchResultsToLegacy converts K8s SearchResults to legacy HitList format
func (hs *HTTPServer) transformK8sSearchResultsToLegacy(k8sResults dashboardv0alpha1.SearchResults, c *contextmodel.ReqContext) model.HitList {
	hits := make(model.HitList, 0, len(k8sResults.Hits))

	// Get starred dashboards if starred filter is requested
	var starredUIDs map[string]bool
	if c.Query("starred") == "true" {
		starredUIDs = hs.getStarredDashboardUIDs(c)
	}

	for _, k8sHit := range k8sResults.Hits {
		// Filter by starred if requested
		if starredUIDs != nil && !starredUIDs[k8sHit.Name] {
			continue
		}

		hit := &model.Hit{
			UID:       k8sHit.Name,
			Title:     k8sHit.Title,
			Tags:      k8sHit.Tags,
			Type:      hs.mapResourceTypeToHitType(k8sHit.Resource),
			FolderUID: k8sHit.Folder,
			IsStarred: starredUIDs != nil && starredUIDs[k8sHit.Name],
		}

		// Set description if available
		if k8sHit.Description != "" {
			hit.Description = k8sHit.Description
		}

		// Extract sort metadata from Field if available
		if k8sHit.Field != nil {
			sortMeta := k8sHit.Field.GetNestedInt64("sortMeta")
			if sortMeta > 0 {
				hit.SortMeta = sortMeta
			}
		}

		// Set URL and URI
		if k8sHit.Resource == "folders" {
			hit.URL = fmt.Sprintf("/dashboards/f/%s", k8sHit.Name)
			hit.URI = fmt.Sprintf("db/folders/%s", k8sHit.Name)
		} else {
			hit.URL = fmt.Sprintf("/d/%s", k8sHit.Name)
			hit.URI = fmt.Sprintf("db/%s", k8sHit.Name)
		}

		// Set org ID
		hit.OrgID = c.GetOrgID()

		// TODO: Set ID, Slug, FolderID, FolderTitle, FolderURL if needed
		// These require additional lookups or are deprecated

		hits = append(hits, hit)
	}

	return hits
}

// mapResourceTypeToHitType converts K8s resource type to legacy HitType
func (hs *HTTPServer) mapResourceTypeToHitType(resource string) model.HitType {
	switch resource {
	case "folders":
		return model.DashHitFolder
	case "dashboards":
		return model.DashHitDB
	default:
		return model.DashHitDB
	}
}

// getStarredDashboardUIDs retrieves starred dashboard UIDs for the current user
func (hs *HTTPServer) getStarredDashboardUIDs(c *contextmodel.ReqContext) map[string]bool {
	if hs.starService == nil {
		return make(map[string]bool)
	}

	starredQuery := star.GetUserStarsQuery{
		UserID: c.SignedInUser.UserID,
	}
	starredResult, err := hs.starService.GetByUser(c.Req.Context(), &starredQuery)
	if err != nil {
		return make(map[string]bool)
	}

	return starredResult.UserStars
}


// swagger:route GET /search/sorting search listSortOptions
//
// List search sorting options.
//
// Responses:
// 200: listSortOptionsResponse
// 401: unauthorisedError
func (hs *HTTPServer) ListSortOptions(c *contextmodel.ReqContext) response.Response {
	// Check if we should delegate to K8s API
	if hs.Features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchUI) {
		return hs.listSortOptionsViaK8sAPI(c)
	}

	// Legacy path
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

// listSortOptionsViaK8sAPI delegates sort options request to K8s API
func (hs *HTTPServer) listSortOptionsViaK8sAPI(c *contextmodel.ReqContext) response.Response {
	user, err := identity.GetRequester(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusUnauthorized, "Unauthorized", err)
	}

	// Get Kubernetes REST client
	client, err := kubernetes.NewForConfig(hs.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create K8s client", err)
	}

	// Build namespace
	namespaceMapper := request.GetNamespaceMapper(hs.Cfg)
	namespace := namespaceMapper(user.GetOrgID())

	// Make request to K8s API
	result := client.RESTClient().Get().
		Prefix("apis", "dashboard.grafana.app", "v0alpha1").
		Namespace(namespace).
		Resource("search").
		SubResource("sortable").
		Do(c.Req.Context())

	if err := result.Error(); err != nil {
		return response.Error(http.StatusInternalServerError, "K8s API request failed", err)
	}

	// Read response body
	body, err := result.Raw()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to read response", err)
	}

	// Parse K8s response
	var k8sSortable dashboardv0alpha1.SortableFields
	if err := json.Unmarshal(body, &k8sSortable); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to parse response", err)
	}

	// Transform K8s response to legacy format
	res := []util.DynMap{}
	for _, field := range k8sSortable.Fields {
		res = append(res, util.DynMap{
			"name":        field.Field,
			"displayName": field.Display,
			"description": "",
			"meta":        field.Type,
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

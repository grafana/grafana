package queryhistory

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (s *QueryHistoryService) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/query-history", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, routing.Wrap(s.createHandler))
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(s.searchHandler))
		entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(s.deleteHandler))
		entities.Post("/star/:uid", middleware.ReqSignedIn, routing.Wrap(s.starHandler))
		entities.Delete("/star/:uid", middleware.ReqSignedIn, routing.Wrap(s.unstarHandler))
		entities.Patch("/:uid", middleware.ReqSignedIn, routing.Wrap(s.patchCommentHandler))
	})
}

// swagger:route POST /query-history query_history createQuery
//
// Add query to query history.
//
// Adds new query to query history.
//
// Responses:
// 200: getQueryHistoryResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (s *QueryHistoryService) createHandler(c *contextmodel.ReqContext) response.Response {
	cmd := CreateQueryInQueryHistoryCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	query, err := s.CreateQueryInQueryHistory(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}

// swagger:route GET /query-history query_history searchQueries
//
// Query history search.
//
// Returns a list of queries in the query history that matches the search criteria.
// Query history search supports pagination. Use the `limit` parameter to control the maximum number of queries returned; the default limit is 100.
// You can also use the `page` query parameter to fetch queries from any page other than the first one.
//
// Responses:
// 200: getQueryHistorySearchResponse
// 401: unauthorisedError
// 500: internalServerError
func (s *QueryHistoryService) searchHandler(c *contextmodel.ReqContext) response.Response {
	timeRange := legacydata.NewDataTimeRange(c.Query("from"), c.Query("to"))

	query := SearchInQueryHistoryQuery{
		DatasourceUIDs: c.QueryStrings("datasourceUid"),
		SearchString:   c.Query("searchString"),
		OnlyStarred:    c.QueryBoolWithDefault("onlyStarred", false),
		Sort:           c.Query("sort"),
		Page:           c.QueryInt("page"),
		Limit:          c.QueryInt("limit"),
		From:           timeRange.GetFromAsSecondsEpoch(),
		To:             timeRange.GetToAsSecondsEpoch(),
	}

	result, err := s.SearchInQueryHistory(c.Req.Context(), c.SignedInUser, query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistorySearchResponse{Result: result})
}

// swagger:route DELETE /query-history/{query_history_uid} query_history deleteQuery
//
// Delete query in query history.
//
// Deletes an existing query in query history as specified by the UID. This operation cannot be reverted.
//
// Responses:
// 200: getQueryHistoryDeleteQueryResponse
// 401: unauthorisedError
// 500: internalServerError
func (s *QueryHistoryService) deleteHandler(c *contextmodel.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	id, err := s.DeleteQueryFromQueryHistory(c.Req.Context(), c.SignedInUser, queryUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete query from query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryDeleteQueryResponse{
		Message: "Query deleted",
		ID:      id,
	})
}

// swagger:route PATCH /query-history/{query_history_uid} query_history patchQueryComment
//
// Update comment for query in query history.
//
// Updates comment for query in query history as specified by the UID.
//
// Responses:
// 200: getQueryHistoryResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (s *QueryHistoryService) patchCommentHandler(c *contextmodel.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	cmd := PatchQueryCommentInQueryHistoryCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	query, err := s.PatchQueryCommentInQueryHistory(c.Req.Context(), c.SignedInUser, queryUID, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update comment of query in query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}

// swagger:route POST /query-history/star/{query_history_uid} query_history starQuery
//
// Add star to query in query history.
//
// Adds star to query in query history as specified by the UID.
//
// Responses:
// 200: getQueryHistoryResponse
// 401: unauthorisedError
// 500: internalServerError
func (s *QueryHistoryService) starHandler(c *contextmodel.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	query, err := s.StarQueryInQueryHistory(c.Req.Context(), c.SignedInUser, queryUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to star query in query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}

// swagger:route DELETE /query-history/star/{query_history_uid} query_history unstarQuery
//
// Remove star to query in query history.
//
// Removes star from query in query history as specified by the UID.
//
// Responses:
// 200: getQueryHistoryResponse
// 401: unauthorisedError
// 500: internalServerError
func (s *QueryHistoryService) unstarHandler(c *contextmodel.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	query, err := s.UnstarQueryInQueryHistory(c.Req.Context(), c.SignedInUser, queryUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to unstar query in query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}

// swagger:parameters starQuery patchQueryComment deleteQuery unstarQuery
type QueryHistoryByUID struct {
	// in:path
	// required:true
	UID string `json:"query_history_uid"`
}

// swagger:parameters searchQueries
type SearchQueriesParams struct {
	// List of data source UIDs to search for
	// in:query
	// required: false
	// type: array
	// collectionFormat: multi
	DatasourceUid []string `json:"datasourceUid"`
	// Text inside query or comments that is searched for
	// in:query
	// required: false
	SearchString string `json:"searchString"`
	// Flag indicating if only starred queries should be returned
	// in:query
	// required: false
	OnlyStarred bool `json:"onlyStarred"`
	// Sort method
	// in:query
	// required: false
	// default: time-desc
	// Enum: time-desc,time-asc
	Sort string `json:"sort"`
	// Use this parameter to access hits beyond limit. Numbering starts at 1. limit param acts as page size.
	// in:query
	// required: false
	Page int `json:"page"`
	// Limit the number of returned results
	// in:query
	// required: false
	Limit int `json:"limit"`
	// From range for the query history search
	// in:query
	// required: false
	From int64 `json:"from"`
	// To range for the query history search
	// in:query
	// required: false
	To int64 `json:"to"`
}

// swagger:parameters createQuery
type CreateQueryParams struct {
	// in:body
	// required:true
	Body CreateQueryInQueryHistoryCommand `json:"body"`
}

// swagger:parameters patchQueryComment
type PatchQueryCommentParams struct {
	// in:body
	// required:true
	Body PatchQueryCommentInQueryHistoryCommand `json:"body"`
}

//swagger:response getQueryHistorySearchResponse
type GetQueryHistorySearchResponse struct {
	// in: body
	Body QueryHistorySearchResponse `json:"body"`
}

// swagger:response getQueryHistoryResponse
type GetQueryHistoryResponse struct {
	// in: body
	Body QueryHistoryResponse `json:"body"`
}

// swagger:response getQueryHistoryDeleteQueryResponse
type GetQueryHistoryDeleteQueryResponse struct {
	// in: body
	Body QueryHistoryDeleteQueryResponse `json:"body"`
}

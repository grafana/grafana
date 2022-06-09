package definitions

import (
	"github.com/grafana/grafana/pkg/services/queryhistory"
)

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

// swagger:route POST /query-history/migrate query_history migrateQueries
//
// Migrate queries to query history.
//
// Adds multiple queries to query history.
//
// Responses:
// 200: getQueryHistoryMigrationResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError

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

// swagger:parameters starQuery patchQueryComment deleteQuery unstarQuery
type QueryHistoryByUID struct {
	// in:path
	// required:true
	UID string `json:"query_history_uid"`
}

//swagger:response getQueryHistorySearchResponse
type GetQueryHistorySearchResponse struct {
	// in: body
	Body queryhistory.QueryHistorySearchResponse `json:"body"`
}

// swagger:response getQueryHistoryResponse
type GetQueryHistoryResponse struct {
	// in: body
	Body queryhistory.QueryHistoryResponse `json:"body"`
}

// swagger:response getQueryHistoryDeleteQueryResponse
type GetQueryHistoryDeleteQueryResponse struct {
	// in: body
	Body queryhistory.QueryHistoryDeleteQueryResponse `json:"body"`
}

// swagger:response getQueryHistoryMigrationResponse
type GetQueryHistoryMigrationResponse struct {
	// in: body
	Body queryhistory.QueryHistoryMigrationResponse `json:"body"`
}

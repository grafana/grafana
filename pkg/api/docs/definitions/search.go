package definitions

import "github.com/grafana/grafana/pkg/models"

// swagger:route GET /search/sorting search searchSorting
//
// List search sorting options
//
// Responses:
// 200: searchSortingResponse
// 401: unauthorisedError

// swagger:route GET /search search search
//
// Responses:
// 200: searchResponse
// 401: unauthorisedError
// 422: unprocessableEntityError
// 500: internalServerError

// swagger:parameters search
type SearchParameters struct {
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
	Body models.HitList `json:"body"`
}

// swagger:response searchSortingResponse
type SearchSortingResponse struct {
	// in: body
	Body struct {
		Name        string `json:"name"`
		DisplayName string `json:"displayName"`
		Description string `json:"description"`
		Meta        string `json:"meta"`
	} `json:"body"`
}

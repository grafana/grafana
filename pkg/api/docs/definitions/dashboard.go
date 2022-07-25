package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
)

// swagger:route GET /dashboards/uid/{uid} dashboards getDashboardByUID
//
// Get dashboard by uid.
//
// Will return the dashboard given the dashboard unique identifier (uid).
//
// Responses:
// 200: dashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// DeleteDashboardByUID swagger:route DELETE /dashboards/uid/{uid} dashboards deleteDashboardByUID
//
// Delete dashboard by uid.
//
// Will delete the dashboard given the specified unique identifier (uid).
//
// Responses:
// 200: deleteDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /dashboards/calculate-diff dashboards calcDashboardDiff
//
// Perform diff on two dashboards.
//
// Produces:
// - application/json
// - text/html
//
// Responses:
// 200: dashboardDiffResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /dashboards/trim dashboards trimDashboard
//
// Trim defaults from dashboard.
//
// Responses:
// 200: trimDashboardResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route POST /dashboards/db dashboards postDashboard
//
// Create / Update dashboard
//
// Creates a new dashboard or updates an existing dashboard.
//
// Responses:
// 200: postDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 412: preconditionFailedError
// 422: unprocessableEntityError
// 500: internalServerError

// swagger:route GET /dashboards/home dashboards getHomeDashboard
//
// Get home dashboard.
//
// Responses:
// 200: getHomeDashboardResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route GET /dashboards/tags dashboards getDashboardTags
//
// Get all dashboards tags of an organisation.
//
// Responses:
// 200: dashboardsTagsResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route POST /dashboards/import dashboards importDashboard
//
// Import dashboard.
//
// Responses:
// 200: importDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 412: preconditionFailedError
// 422: unprocessableEntityError
// 500: internalServerError

// swagger:parameters getDashboardByUID
type GetDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters deleteDashboardByUID
type DeleteDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getDashboardPermissionsWithUid postDashboardPermissionsWithUid getDashboardVersionByUID
// swagger:parameters getDashboardVersionsByUID restoreDashboardVersionByUID
type UID struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters postDashboard
type PostDashboardParam struct {
	// in:body
	// required:true
	Body models.SaveDashboardCommand
}

// swagger:parameters calcDashboardDiff
type CalcDashboardDiffOptions struct {
	// in:body
	// required:true
	Body struct {
		Base dtos.CalculateDiffTarget `json:"base" binding:"Required"`
		New  dtos.CalculateDiffTarget `json:"new" binding:"Required"`
		// The type of diff to return
		// Description:
		// * `basic`
		// * `json`
		// Enum: basic,json
		DiffType string `json:"diffType" binding:"Required"`
	}
}

// swagger:parameters trimDashboard
type TrimDashboardParam struct {
	// in:body
	// required:true
	Body models.TrimDashboardCommand
}

// swagger:parameters importDashboard
type ImportDashboardParam struct {
	// in:body
	// required:true
	Body dashboardimport.ImportDashboardRequest
}

// swagger:response dashboardResponse
type DashboardResponse struct {
	// The response message
	// in: body
	Body dtos.DashboardFullWithMeta `json:"body"`
}

// swagger:response deleteDashboardResponse
type DeleteDashboardResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the deleted dashboard.
		// required: true
		// example: 65
		ID int64 `json:"id"`

		// Title Title of the deleted dashboard.
		// required: true
		// example: My Dashboard
		Title string `json:"title"`

		// Message Message of the deleted dashboard.
		// required: true
		// example: Dashboard My Dashboard deleted
		Message string `json:"message"`
	} `json:"body"`
}

// Create/update dashboard response.
// swagger:response postDashboardResponse
type PostDashboardResponse struct {
	// in: body
	Body struct {
		// Status status of the response.
		// required: true
		// example: success
		Status string `json:"status"`

		// Slug The slug of the dashboard.
		// required: true
		// example: my-dashboard
		Slug string `json:"title"`

		// Version The version of the dashboard.
		// required: true
		// example: 2
		Verion int64 `json:"version"`

		// ID The unique identifier (id) of the created/updated dashboard.
		// required: true
		// example: 1
		ID string `json:"id"`

		// UID The unique identifier (uid) of the created/updated dashboard.
		// required: true
		// example: nHz3SXiiz
		UID string `json:"uid"`

		// URL The relative URL for accessing the created/updated dashboard.
		// required: true
		// example: /d/nHz3SXiiz/my-dashboard
		URL string `json:"url"`
	} `json:"body"`
}

// Calculate dashboard diff response.
// swagger:response dashboardDiffResponse
type DashboardDiffResponse struct {
	// in: body
	Body []byte `json:"body"`
}

// Trimmed dashboard response.
// swagger:response trimDashboardResponse
type TrimDashboardResponse struct {
	// in: body
	Body dtos.TrimDashboardFullWithMeta `json:"body"`
}

// Home dashboard response.
// swagger:response getHomeDashboardResponse
type GetHomeDashboardResponse struct {
	// in: body
	Body GetHomeDashboardResponseBody `json:"body"`
}

// swagger:response dashboardsTagsResponse
type DashboardsTagsResponse struct {
	// in: body
	Body []*models.DashboardTagCloudItem `json:"body"`
}

// swagger:response importDashboardResponse
type ImportDashboardResponse struct {
	// in: body
	Body dashboardimport.ImportDashboardResponse `json:"body"`
}

// Get home dashboard response.
// swagger:model GetHomeDashboardResponse
type GetHomeDashboardResponseBody struct {
	// swagger:allOf
	// required: false
	dtos.DashboardFullWithMeta

	// swagger:allOf
	// required: false
	dtos.DashboardRedirect
}

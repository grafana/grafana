package models

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrInternalServerError = errutil.Internal("publicdashboards.internalServerError", errutil.WithPublicMessage("Internal server error"))

	ErrPublicDashboardNotFound = errutil.NotFound("publicdashboards.notFound", errutil.WithPublicMessage("Public dashboard not found"))
	ErrDashboardNotFound       = errutil.NotFound("publicdashboards.dashboardNotFound", errutil.WithPublicMessage("Dashboard not found"))
	ErrPanelNotFound           = errutil.NotFound("publicdashboards.panelNotFound", errutil.WithPublicMessage("Public dashboard panel not found"))

	ErrBadRequest                          = errutil.BadRequest("publicdashboards.badRequest")
	ErrPanelQueriesNotFound                = errutil.BadRequest("publicdashboards.panelQueriesNotFound", errutil.WithPublicMessage("Failed to extract queries from panel"))
	ErrInvalidAccessToken                  = errutil.BadRequest("publicdashboards.invalidAccessToken", errutil.WithPublicMessage("Invalid access token"))
	ErrInvalidPanelId                      = errutil.BadRequest("publicdashboards.invalidPanelId", errutil.WithPublicMessage("Invalid panel id"))
	ErrInvalidUid                          = errutil.BadRequest("publicdashboards.invalidUid", errutil.WithPublicMessage("Invalid Uid"))
	ErrPublicDashboardIdentifierNotSet     = errutil.BadRequest("publicdashboards.identifierNotSet", errutil.WithPublicMessage("No Uid for public dashboard specified"))
	ErrPublicDashboardHasTemplateVariables = errutil.BadRequest("publicdashboards.hasTemplateVariables", errutil.WithPublicMessage("Public dashboard has template variables"))
	ErrInvalidInterval                     = errutil.BadRequest("publicdashboards.invalidInterval", errutil.WithPublicMessage("intervalMS should be greater than 0"))
	ErrInvalidMaxDataPoints                = errutil.BadRequest("publicdashboards.maxDataPoints", errutil.WithPublicMessage("maxDataPoints should be greater than 0"))
	ErrInvalidTimeRange                    = errutil.BadRequest("publicdashboards.invalidTimeRange", errutil.WithPublicMessage("Invalid time range"))
	ErrInvalidShareType                    = errutil.BadRequest("publicdashboards.invalidShareType", errutil.WithPublicMessage("Invalid share type"))
	ErrDashboardIsPublic                   = errutil.BadRequest("publicdashboards.dashboardIsPublic", errutil.WithPublicMessage("Dashboard is already public"))
	ErrPublicDashboardUidExists            = errutil.BadRequest("publicdashboards.uidExists", errutil.WithPublicMessage("Public Dashboard Uid already exists"))
	ErrPublicDashboardAccessTokenExists    = errutil.BadRequest("publicdashboards.accessTokenExists", errutil.WithPublicMessage("Public Dashboard Access Token already exists"))

	ErrPublicDashboardNotEnabled = errutil.Forbidden("publicdashboards.notEnabled", errutil.WithPublicMessage("Public dashboard paused"))
)

// DashboardAccessTokenExistsPublicError is returned when the dashboard access token already exists.
//
// swagger:response dashboardAccessTokenExistsPublicError
type DashboardAccessTokenExistsPublicError errutil.PublicErrorResponse

// IdentifierNotSetPublicError the identifier is not provided.
//
// swagger:response identifierNotSetPublicError
type IdentifierNotSetPublicError errutil.PublicErrorResponse

// InvalidUidPublicError is returned when the uid provided is not valid.
//
// swagger:response invalidUidPublicError
type InvalidUidPublicError errutil.PublicErrorResponse

// InvalidAccessTokenPublicError is returned when the access token provided is not valid.
//
// swagger:response invalidAccessTokenPublicError
type InvalidAccessTokenPublicError errutil.PublicErrorResponse

// InvalidShareTypePublicError is returned when the share type provided is not valid.
//
// swagger:response invalidShareTypePublicError
type InvalidShareTypePublicError errutil.PublicErrorResponse

// DashboardNotFoundPublicError is returned when the dashboard is not found.
//
// swagger:response dashboardNotFoundPublicError
type DashboardNotFoundPublicError errutil.PublicErrorResponse

// PublicDashboardNotFoundPublicError is returned when the public dashboard is not found.
//
// swagger:response publicDashboardNotFoundPublicError
type PublicDashboardNotFoundPublicError errutil.PublicErrorResponse

// DashboardIsPublicPublicError is returned when the dashboard is already public.
//
// swagger:response dashboardIsPublicPublicError
type DashboardIsPublicPublicError errutil.PublicErrorResponse

// DashboardUidExistsPublicError is returned when the dashboard uid already exists.
//
// swagger:response dashboardUidExistsPublicError
type DashboardUidExistsPublicError errutil.PublicErrorResponse

// PublicDashboardNotEnabledError is returned when the public dashboard is not enabled.
//
// swagger:response publicDashboardNotEnabledError
type PublicDashboardNotEnabledError errutil.PublicErrorResponse

// InvalidPanelIdPublicError is returned when the panel is not valid
//
// swagger:response invalidPanelIdPublicError
type InvalidPanelIdPublicError errutil.PublicErrorResponse

// InvalidIntervalPublicError is returned when the interval is not valid
//
// swagger:response invalidIntervalPublicError
type InvalidIntervalPublicError errutil.PublicErrorResponse

// InvalidMaxDataPointsPublicError is returned when the max data points is not valid
//
// swagger:response invalidMaxDataPointsPublicError
type InvalidMaxDataPointsPublicError errutil.PublicErrorResponse

// InvalidTimeRangePublicError is returned when the time range is not valid
//
// swagger:response invalidTimeRangePublicError
type InvalidTimeRangePublicError errutil.PublicErrorResponse

// PanelNotFoundPublicError is returned when the panel is not found
//
// swagger:response panelNotFoundPublicError
type PanelNotFoundPublicError errutil.PublicErrorResponse

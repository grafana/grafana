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

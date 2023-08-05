package models

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrInternalServerError = errutil.NewBase(errutil.StatusInternal, "publicdashboards.internalServerError", errutil.WithPublicMessage("Internal server error"))

	ErrPublicDashboardNotFound = errutil.NewBase(errutil.StatusNotFound, "publicdashboards.notFound", errutil.WithPublicMessage("Public dashboard not found"))
	ErrDashboardNotFound       = errutil.NewBase(errutil.StatusNotFound, "publicdashboards.dashboardNotFound", errutil.WithPublicMessage("Dashboard not found"))
	ErrPanelNotFound           = errutil.NewBase(errutil.StatusNotFound, "publicdashboards.panelNotFound", errutil.WithPublicMessage("Public dashboard panel not found"))

	ErrBadRequest                          = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.badRequest")
	ErrPanelQueriesNotFound                = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.panelQueriesNotFound", errutil.WithPublicMessage("Failed to extract queries from panel"))
	ErrInvalidAccessToken                  = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.invalidAccessToken", errutil.WithPublicMessage("Invalid access token"))
	ErrInvalidPanelId                      = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.invalidPanelId", errutil.WithPublicMessage("Invalid panel id"))
	ErrInvalidUid                          = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.invalidUid", errutil.WithPublicMessage("Invalid Uid"))
	ErrPublicDashboardIdentifierNotSet     = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.identifierNotSet", errutil.WithPublicMessage("No Uid for public dashboard specified"))
	ErrPublicDashboardHasTemplateVariables = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.hasTemplateVariables", errutil.WithPublicMessage("Public dashboard has template variables"))
	ErrInvalidInterval                     = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.invalidInterval", errutil.WithPublicMessage("intervalMS should be greater than 0"))
	ErrInvalidMaxDataPoints                = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.maxDataPoints", errutil.WithPublicMessage("maxDataPoints should be greater than 0"))
	ErrInvalidTimeRange                    = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.invalidTimeRange", errutil.WithPublicMessage("Invalid time range"))
	ErrInvalidShareType                    = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.invalidShareType", errutil.WithPublicMessage("Invalid share type"))
	ErrDashboardIsPublic                   = errutil.NewBase(errutil.StatusBadRequest, "publicdashboards.dashboardIsPublic", errutil.WithPublicMessage("Dashboard is already public"))

	ErrPublicDashboardNotEnabled = errutil.NewBase(errutil.StatusForbidden, "publicdashboards.notEnabled", errutil.WithPublicMessage("Public dashboard paused"))
)

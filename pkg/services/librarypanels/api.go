package librarypanels

import (
	"errors"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func (lps *LibraryPanelService) registerAPIEndpoints() {
	if !lps.IsEnabled() {
		return
	}

	lps.RouteRegister.Group("/api/library-panels", func(libraryPanels routing.RouteRegister) {
		libraryPanels.Post("/", middleware.ReqSignedIn, binding.Bind(createLibraryPanelCommand{}), routing.Wrap(lps.createHandler))
		libraryPanels.Post("/:uid/dashboards/:dashboardId", middleware.ReqSignedIn, routing.Wrap(lps.connectHandler))
		libraryPanels.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(lps.deleteHandler))
		libraryPanels.Delete("/:uid/dashboards/:dashboardId", middleware.ReqSignedIn, routing.Wrap(lps.disconnectHandler))
		libraryPanels.Get("/", middleware.ReqSignedIn, routing.Wrap(lps.getAllHandler))
		libraryPanels.Get("/:uid", middleware.ReqSignedIn, routing.Wrap(lps.getHandler))
		libraryPanels.Get("/:uid/dashboards/", middleware.ReqSignedIn, routing.Wrap(lps.getConnectedDashboardsHandler))
		libraryPanels.Patch("/:uid", middleware.ReqSignedIn, binding.Bind(patchLibraryPanelCommand{}), routing.Wrap(lps.patchHandler))
	})
}

// createHandler handles POST /api/library-panels.
func (lps *LibraryPanelService) createHandler(c *models.ReqContext, cmd createLibraryPanelCommand) response.Response {
	panel, err := lps.createLibraryPanel(c, cmd)
	if err != nil {
		if errors.Is(err, errLibraryPanelAlreadyExists) {
			return response.Error(400, errLibraryPanelAlreadyExists.Error(), err)
		}
		return response.Error(500, "Failed to create library panel", err)
	}

	return response.JSON(200, util.DynMap{"result": panel})
}

// connectHandler handles POST /api/library-panels/:uid/dashboards/:dashboardId.
func (lps *LibraryPanelService) connectHandler(c *models.ReqContext) response.Response {
	if err := lps.connectDashboard(c, c.Params(":uid"), c.ParamsInt64(":dashboardId")); err != nil {
		if errors.Is(err, errLibraryPanelNotFound) {
			return response.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return response.Error(500, "Failed to connect library panel", err)
	}

	return response.Success("Library panel connected")
}

// deleteHandler handles DELETE /api/library-panels/:uid.
func (lps *LibraryPanelService) deleteHandler(c *models.ReqContext) response.Response {
	err := lps.deleteLibraryPanel(c, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, errLibraryPanelNotFound) {
			return response.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return response.Error(500, "Failed to delete library panel", err)
	}

	return response.Success("Library panel deleted")
}

// disconnectHandler handles DELETE /api/library-panels/:uid/dashboards/:dashboardId.
func (lps *LibraryPanelService) disconnectHandler(c *models.ReqContext) response.Response {
	err := lps.disconnectDashboard(c, c.Params(":uid"), c.ParamsInt64(":dashboardId"))
	if err != nil {
		if errors.Is(err, errLibraryPanelNotFound) {
			return response.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		if errors.Is(err, errLibraryPanelDashboardNotFound) {
			return response.Error(404, errLibraryPanelDashboardNotFound.Error(), err)
		}
		return response.Error(500, "Failed to disconnect library panel", err)
	}

	return response.Success("Library panel disconnected")
}

// getHandler handles GET /api/library-panels/:uid.
func (lps *LibraryPanelService) getHandler(c *models.ReqContext) response.Response {
	libraryPanel, err := lps.getLibraryPanel(c, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, errLibraryPanelNotFound) {
			return response.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return response.Error(500, "Failed to get library panel", err)
	}

	return response.JSON(200, util.DynMap{"result": libraryPanel})
}

// getAllHandler handles GET /api/library-panels/.
func (lps *LibraryPanelService) getAllHandler(c *models.ReqContext) response.Response {
	libraryPanels, err := lps.getAllLibraryPanels(c)
	if err != nil {
		return response.Error(500, "Failed to get library panels", err)
	}

	return response.JSON(200, util.DynMap{"result": libraryPanels})
}

// getConnectedDashboardsHandler handles GET /api/library-panels/:uid/dashboards/.
func (lps *LibraryPanelService) getConnectedDashboardsHandler(c *models.ReqContext) response.Response {
	dashboardIDs, err := lps.getConnectedDashboards(c, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, errLibraryPanelNotFound) {
			return response.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return response.Error(500, "Failed to get connected dashboards", err)
	}

	return response.JSON(200, util.DynMap{"result": dashboardIDs})
}

// patchHandler handles PATCH /api/library-panels/:uid
func (lps *LibraryPanelService) patchHandler(c *models.ReqContext, cmd patchLibraryPanelCommand) response.Response {
	libraryPanel, err := lps.patchLibraryPanel(c, cmd, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, errLibraryPanelAlreadyExists) {
			return response.Error(400, errLibraryPanelAlreadyExists.Error(), err)
		}
		if errors.Is(err, errLibraryPanelNotFound) {
			return response.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return response.Error(500, "Failed to update library panel", err)
	}

	return response.JSON(200, util.DynMap{"result": libraryPanel})
}

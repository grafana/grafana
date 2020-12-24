package librarypanels

import (
	"errors"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api"
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
		libraryPanels.Post("/", middleware.ReqSignedIn, binding.Bind(createLibraryPanelCommand{}), api.Wrap(lps.createHandler))
		libraryPanels.Delete("/:uid", middleware.ReqSignedIn, api.Wrap(lps.deleteHandler))
		libraryPanels.Get("/", middleware.ReqSignedIn, api.Wrap(lps.getAllHandler))
		libraryPanels.Get("/:uid", middleware.ReqSignedIn, api.Wrap(lps.getHandler))
		libraryPanels.Patch("/:uid", middleware.ReqSignedIn, binding.Bind(patchLibraryPanelCommand{}), api.Wrap(lps.patchHandler))
	})
}

// createHandler handles POST /api/library-panels.
func (lps *LibraryPanelService) createHandler(c *models.ReqContext, cmd createLibraryPanelCommand) api.Response {
	panel, err := lps.createLibraryPanel(c, cmd)
	if err != nil {
		if errors.Is(err, errLibraryPanelAlreadyExists) {
			return api.Error(400, errLibraryPanelAlreadyExists.Error(), err)
		}
		return api.Error(500, "Failed to create library panel", err)
	}

	return api.JSON(200, util.DynMap{"result": panel})
}

// deleteHandler handles DELETE /api/library-panels/:uid
func (lps *LibraryPanelService) deleteHandler(c *models.ReqContext) api.Response {
	err := lps.deleteLibraryPanel(c, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, errLibraryPanelNotFound) {
			return api.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return api.Error(500, "Failed to delete library panel", err)
	}

	return api.Success("Library panel deleted")
}

// getHandler handles GET /api/library-panels/:uid
func (lps *LibraryPanelService) getHandler(c *models.ReqContext) api.Response {
	libraryPanel, err := lps.getLibraryPanel(c, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, errLibraryPanelNotFound) {
			return api.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return api.Error(500, "Failed to get library panel", err)
	}

	return api.JSON(200, util.DynMap{"result": libraryPanel})
}

// getAllHandler handles GET /api/library-panels/
func (lps *LibraryPanelService) getAllHandler(c *models.ReqContext) api.Response {
	libraryPanels, err := lps.getAllLibraryPanels(c)
	if err != nil {
		return api.Error(500, "Failed to get library panels", err)
	}

	return api.JSON(200, util.DynMap{"result": libraryPanels})
}

// patchHandler handles PATCH /api/library-panels/:uid
func (lps *LibraryPanelService) patchHandler(c *models.ReqContext, cmd patchLibraryPanelCommand) api.Response {
	libraryPanel, err := lps.patchLibraryPanel(c, cmd, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, errLibraryPanelAlreadyExists) {
			return api.Error(400, errLibraryPanelAlreadyExists.Error(), err)
		}
		if errors.Is(err, errLibraryPanelNotFound) {
			return api.Error(404, errLibraryPanelNotFound.Error(), err)
		}
		return api.Error(500, "Failed to update library panel", err)
	}

	return api.JSON(200, util.DynMap{"result": libraryPanel})
}

package entities

import (
	"errors"

	"github.com/go-macaron/binding"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func (e *EntityService) registerAPIEndpoints() {
	if !e.IsEnabled() {
		return
	}

	e.RouteRegister.Group("/api/entities", func(entities routing.RouteRegister) {
		entities.Post("/:kind/", middleware.ReqSignedIn, binding.Bind(createEntityCommand{}), routing.Wrap(e.createHandler))
		//entities.Post("/:uid/dashboards/:dashboardId", middleware.ReqSignedIn, routing.Wrap(e.connectHandler))
		//entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(e.deleteHandler))
		//entities.Delete("/:uid/dashboards/:dashboardId", middleware.ReqSignedIn, routing.Wrap(e.disconnectHandler))
		//entities.Get("/", middleware.ReqSignedIn, routing.Wrap(e.getAllHandler))
		//entities.Get("/:uid", middleware.ReqSignedIn, routing.Wrap(e.getHandler))
		//entities.Get("/:uid/dashboards/", middleware.ReqSignedIn, routing.Wrap(e.getConnectedDashboardsHandler))
		//entities.Patch("/:uid", middleware.ReqSignedIn, binding.Bind(patchLibraryPanelCommand{}), routing.Wrap(e.patchHandler))
	})
}

// createHandler handles POST /api/entities/:kind/.
func (e *EntityService) createHandler(c *models.ReqContext, cmd createEntityCommand) response.Response {
	panel, err := e.createEntity(c, cmd, c.ParamsInt(":kind"))
	if err != nil {
		return toEntityError(err, "Failed to create library panel")
	}

	return response.JSON(200, util.DynMap{"result": panel})
}

func toEntityError(err error, message string) response.Response {
	if errors.Is(err, errEntityAlreadyExists) {
		return response.Error(400, errEntityAlreadyExists.Error(), err)
	}
	if errors.Is(err, errEntityNotFound) {
		return response.Error(404, errEntityNotFound.Error(), err)
	}
	if errors.Is(err, errEntityDashboardNotFound) {
		return response.Error(404, errEntityDashboardNotFound.Error(), err)
	}
	if errors.Is(err, errEntityHeaderUIDMissing) {
		return response.Error(412, errEntityHeaderUIDMissing.Error(), err)
	}
	if errors.Is(err, models.ErrFolderNotFound) {
		return response.Error(404, models.ErrFolderNotFound.Error(), err)
	}
	if errors.Is(err, models.ErrFolderAccessDenied) {
		return response.Error(403, models.ErrFolderAccessDenied.Error(), err)
	}
	if errors.Is(err, errEntityHasConnectedDashboards) {
		return response.Error(403, errEntityHasConnectedDashboards.Error(), err)
	}
	return response.Error(500, message, err)
}

package libraryelements

import (
	"errors"
	"net/http"

	"github.com/go-macaron/binding"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func (l *LibraryElementService) registerAPIEndpoints() {
	l.RouteRegister.Group("/api/library-elements", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, binding.Bind(CreateLibraryElementCommand{}), routing.Wrap(l.createHandler))
		entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(l.deleteHandler))
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(l.getAllHandler))
		entities.Get("/:uid", middleware.ReqSignedIn, routing.Wrap(l.getHandler))
		entities.Get("/:uid/connections/", middleware.ReqSignedIn, routing.Wrap(l.getConnectionsHandler))
		entities.Patch("/:uid", middleware.ReqSignedIn, binding.Bind(patchLibraryElementCommand{}), routing.Wrap(l.patchHandler))
	})
}

// createHandler handles POST /api/library-elements.
func (l *LibraryElementService) createHandler(c *models.ReqContext, cmd CreateLibraryElementCommand) response.Response {
	element, err := l.createLibraryElement(c, cmd)
	if err != nil {
		return toLibraryElementError(err, "Failed to create library element")
	}

	return response.JSON(http.StatusOK, util.DynMap{"result": element})
}

// deleteHandler handles DELETE /api/library-elements/:uid.
func (l *LibraryElementService) deleteHandler(c *models.ReqContext) response.Response {
	err := l.deleteLibraryElement(c, c.Params(":uid"))
	if err != nil {
		return toLibraryElementError(err, "Failed to delete library element")
	}

	return response.Success("Library element deleted")
}

// getHandler handles GET  /api/library-elements/:uid.
func (l *LibraryElementService) getHandler(c *models.ReqContext) response.Response {
	element, err := l.getLibraryElement(c, c.Params(":uid"))
	if err != nil {
		return toLibraryElementError(err, "Failed to get library element")
	}

	return response.JSON(http.StatusOK, util.DynMap{"result": element})
}

// getAllHandler handles GET /api/library-elements/.
func (l *LibraryElementService) getAllHandler(c *models.ReqContext) response.Response {
	query := searchLibraryElementsQuery{
		perPage:       c.QueryInt("perPage"),
		page:          c.QueryInt("page"),
		searchString:  c.Query("searchString"),
		sortDirection: c.Query("sortDirection"),
		kind:          c.QueryInt("kind"),
		typeFilter:    c.Query("typeFilter"),
		excludeUID:    c.Query("excludeUid"),
		folderFilter:  c.Query("folderFilter"),
	}
	elementsResult, err := l.getAllLibraryElements(c, query)
	if err != nil {
		return toLibraryElementError(err, "Failed to get library elements")
	}

	return response.JSON(http.StatusOK, util.DynMap{"result": elementsResult})
}

// patchHandler handles PATCH /api/library-elements/:uid
func (l *LibraryElementService) patchHandler(c *models.ReqContext, cmd patchLibraryElementCommand) response.Response {
	element, err := l.patchLibraryElement(c, cmd, c.Params(":uid"))
	if err != nil {
		return toLibraryElementError(err, "Failed to update library element")
	}

	return response.JSON(http.StatusOK, util.DynMap{"result": element})
}

// getConnectionsHandler handles GET /api/library-panels/:uid/connections/.
func (l *LibraryElementService) getConnectionsHandler(c *models.ReqContext) response.Response {
	connections, err := l.getConnections(c, c.Params(":uid"))
	if err != nil {
		return toLibraryElementError(err, "Failed to get connections")
	}

	return response.JSON(http.StatusOK, util.DynMap{"result": connections})
}

func toLibraryElementError(err error, message string) response.Response {
	if errors.Is(err, errLibraryElementAlreadyExists) {
		return response.Error(http.StatusBadRequest, errLibraryElementAlreadyExists.Error(), err)
	}
	if errors.Is(err, errLibraryElementNotFound) {
		return response.Error(http.StatusNotFound, errLibraryElementNotFound.Error(), err)
	}
	if errors.Is(err, errLibraryElementDashboardNotFound) {
		return response.Error(http.StatusNotFound, errLibraryElementDashboardNotFound.Error(), err)
	}
	if errors.Is(err, errLibraryElementVersionMismatch) {
		return response.Error(http.StatusPreconditionFailed, errLibraryElementVersionMismatch.Error(), err)
	}
	if errors.Is(err, models.ErrFolderNotFound) {
		return response.Error(http.StatusNotFound, models.ErrFolderNotFound.Error(), err)
	}
	if errors.Is(err, models.ErrFolderAccessDenied) {
		return response.Error(http.StatusForbidden, models.ErrFolderAccessDenied.Error(), err)
	}
	if errors.Is(err, errLibraryElementHasConnections) {
		return response.Error(http.StatusForbidden, errLibraryElementHasConnections.Error(), err)
	}
	return response.Error(http.StatusInternalServerError, message, err)
}

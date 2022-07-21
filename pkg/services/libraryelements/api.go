package libraryelements

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/web"
)

func (l *LibraryElementService) registerAPIEndpoints() {
	l.RouteRegister.Group("/api/library-elements", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, routing.Wrap(l.createHandler))
		entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(l.deleteHandler))
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(l.getAllHandler))
		entities.Get("/:uid", middleware.ReqSignedIn, routing.Wrap(l.getHandler))
		entities.Get("/:uid/connections/", middleware.ReqSignedIn, routing.Wrap(l.getConnectionsHandler))
		entities.Get("/name/:name", middleware.ReqSignedIn, routing.Wrap(l.getByNameHandler))
		entities.Patch("/:uid", middleware.ReqSignedIn, routing.Wrap(l.patchHandler))
	})
}

// createHandler handles POST /api/library-elements.
func (l *LibraryElementService) createHandler(c *models.ReqContext) response.Response {
	cmd := CreateLibraryElementCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if cmd.FolderUID != nil {
		if *cmd.FolderUID == "" {
			cmd.FolderID = 0
		} else {
			folder, err := l.folderService.GetFolderByUID(c.Req.Context(), c.SignedInUser, c.OrgId, *cmd.FolderUID)
			if err != nil || folder == nil {
				return response.Error(http.StatusBadRequest, "failed to get folder", err)
			}
			cmd.FolderID = folder.Id
		}
	}

	element, err := l.createLibraryElement(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return toLibraryElementError(err, "Failed to create library element")
	}

	if element.FolderID != 0 {
		folder, err := l.folderService.GetFolderByID(c.Req.Context(), c.SignedInUser, element.FolderID, c.OrgId)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "failed to get folder", err)
		}
		element.FolderUID = folder.Uid
		element.Meta.FolderUID = folder.Uid
		element.Meta.FolderName = folder.Title
	}

	return response.JSON(http.StatusOK, LibraryElementResponse{Result: element})
}

// deleteHandler handles DELETE /api/library-elements/:uid.
func (l *LibraryElementService) deleteHandler(c *models.ReqContext) response.Response {
	id, err := l.deleteLibraryElement(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		return toLibraryElementError(err, "Failed to delete library element")
	}

	return response.JSON(http.StatusOK, DeleteLibraryElementResponse{
		Message: "Library element deleted",
		ID:      id,
	})
}

// getHandler handles GET  /api/library-elements/:uid.
func (l *LibraryElementService) getHandler(c *models.ReqContext) response.Response {
	element, err := l.getLibraryElementByUid(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		return toLibraryElementError(err, "Failed to get library element")
	}

	return response.JSON(http.StatusOK, LibraryElementResponse{Result: element})
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
	elementsResult, err := l.getAllLibraryElements(c.Req.Context(), c.SignedInUser, query)
	if err != nil {
		return toLibraryElementError(err, "Failed to get library elements")
	}

	return response.JSON(http.StatusOK, LibraryElementSearchResponse{Result: elementsResult})
}

// patchHandler handles PATCH /api/library-elements/:uid
func (l *LibraryElementService) patchHandler(c *models.ReqContext) response.Response {
	cmd := PatchLibraryElementCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if cmd.FolderUID != nil {
		if *cmd.FolderUID == "" {
			cmd.FolderID = 0
		} else {
			folder, err := l.folderService.GetFolderByUID(c.Req.Context(), c.SignedInUser, c.OrgId, *cmd.FolderUID)
			if err != nil || folder == nil {
				return response.Error(http.StatusBadRequest, "failed to get folder", err)
			}
			cmd.FolderID = folder.Id
		}
	}

	element, err := l.patchLibraryElement(c.Req.Context(), c.SignedInUser, cmd, web.Params(c.Req)[":uid"])
	if err != nil {
		return toLibraryElementError(err, "Failed to update library element")
	}

	if element.FolderID != 0 {
		folder, err := l.folderService.GetFolderByID(c.Req.Context(), c.SignedInUser, element.FolderID, c.OrgId)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "failed to get folder", err)
		}
		element.FolderUID = folder.Uid
		element.Meta.FolderUID = folder.Uid
		element.Meta.FolderName = folder.Title
	}

	return response.JSON(http.StatusOK, LibraryElementResponse{Result: element})
}

// getConnectionsHandler handles GET /api/library-panels/:uid/connections/.
func (l *LibraryElementService) getConnectionsHandler(c *models.ReqContext) response.Response {
	connections, err := l.getConnections(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		return toLibraryElementError(err, "Failed to get connections")
	}

	return response.JSON(http.StatusOK, LibraryElementConnectionsResponse{Result: connections})
}

// getByNameHandler handles GET /api/library-elements/name/:name/.
func (l *LibraryElementService) getByNameHandler(c *models.ReqContext) response.Response {
	elements, err := l.getLibraryElementsByName(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":name"])
	if err != nil {
		return toLibraryElementError(err, "Failed to get library element")
	}

	return response.JSON(http.StatusOK, LibraryElementArrayResponse{Result: elements})
}

func toLibraryElementError(err error, message string) response.Response {
	if errors.Is(err, errLibraryElementAlreadyExists) {
		return response.Error(400, errLibraryElementAlreadyExists.Error(), err)
	}
	if errors.Is(err, ErrLibraryElementNotFound) {
		return response.Error(404, ErrLibraryElementNotFound.Error(), err)
	}
	if errors.Is(err, errLibraryElementDashboardNotFound) {
		return response.Error(404, errLibraryElementDashboardNotFound.Error(), err)
	}
	if errors.Is(err, errLibraryElementVersionMismatch) {
		return response.Error(412, errLibraryElementVersionMismatch.Error(), err)
	}
	if errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.Error(404, dashboards.ErrFolderNotFound.Error(), err)
	}
	if errors.Is(err, dashboards.ErrFolderAccessDenied) {
		return response.Error(403, dashboards.ErrFolderAccessDenied.Error(), err)
	}
	if errors.Is(err, errLibraryElementHasConnections) {
		return response.Error(403, errLibraryElementHasConnections.Error(), err)
	}
	if errors.Is(err, errLibraryElementInvalidUID) {
		return response.Error(400, errLibraryElementInvalidUID.Error(), err)
	}
	if errors.Is(err, errLibraryElementUIDTooLong) {
		return response.Error(400, errLibraryElementUIDTooLong.Error(), err)
	}
	return response.Error(500, message, err)
}

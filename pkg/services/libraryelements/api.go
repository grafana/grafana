package libraryelements

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"net/http"
	"slices"
	gosort "sort"
	"strconv"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	apiserverclient "github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
	"github.com/open-feature/go-sdk/openfeature"
)

func (l *LibraryElementService) registerAPIEndpoints() {
	authorize := ac.Middleware(l.AccessControl)

	l.RouteRegister.Group("/api/library-elements", func(entities routing.RouteRegister) {
		uidScope := ScopeLibraryPanelsProvider.GetResourceScopeUID(ac.Parameter(":uid"))
		entities.Post("/", authorize(ac.EvalPermission(ActionLibraryPanelsCreate)), routing.Wrap(l.createHandler))
		entities.Delete("/:uid", authorize(ac.EvalPermission(ActionLibraryPanelsDelete, uidScope)), routing.Wrap(l.deleteHandler))
		entities.Get("/", authorize(ac.EvalPermission(ActionLibraryPanelsRead)), routing.Wrap(l.getAllHandler))
		entities.Get("/:uid", authorize(ac.EvalPermission(ActionLibraryPanelsRead)), routing.Wrap(l.getHandler))
		entities.Get("/:uid/connections/", authorize(ac.EvalPermission(ActionLibraryPanelsRead, uidScope)), routing.Wrap(l.getConnectionsHandler))
		entities.Get("/name/:name", authorize(ac.EvalPermission(ActionLibraryPanelsRead)), routing.Wrap(l.getByNameHandler))
		entities.Patch("/:uid", authorize(ac.EvalPermission(ActionLibraryPanelsWrite, uidScope)), routing.Wrap(l.patchHandler))
	})
}

// useKubernetesLibraryPanels reports whether legacy /api/library-elements requests
// should be served by the k8s /apis endpoints. Evaluated per request so cloud can
// flip the flag per tenant without a restart.
func useKubernetesLibraryPanels(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagLibraryelementsKubernetesLibraryPanels, false, openfeature.TransactionContext(ctx))
}

// swagger:route POST /library-elements library_elements createLibraryElement
//
// Create library element.
//
// Creates a new library element.
//
// Responses:
// 200: getLibraryElementResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (l *LibraryElementService) createHandler(c *contextmodel.ReqContext) response.Response {
	if useKubernetesLibraryPanels(c.Req.Context()) {
		l.k8sHandler.createK8sLibraryElement(c)
		return nil // already handled in the k8s handler
	}

	cmd := model.CreateLibraryElementCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if cmd.FolderUID != nil {
		if *cmd.FolderUID == "" {
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
			// nolint:staticcheck
			cmd.FolderID = 0
			generalFolderUID := ac.GeneralFolderUID
			cmd.FolderUID = &generalFolderUID
		} else {
			folder, err := l.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{OrgID: c.GetOrgID(), UID: cmd.FolderUID, SignedInUser: c.SignedInUser})
			if err != nil || folder == nil {
				return response.ErrOrFallback(http.StatusBadRequest, "failed to get folder", err)
			}
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
			// nolint:staticcheck
			cmd.FolderID = folder.ID
		}
	}

	element, err := l.CreateElement(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return l.toLibraryElementError(err, "Failed to create library element")
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
	// nolint:staticcheck
	if element.FolderID != 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		// nolint:staticcheck
		folder, err := l.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{OrgID: c.SignedInUser.GetOrgID(), ID: &element.FolderID, SignedInUser: c.SignedInUser})
		if err != nil {
			return response.ErrOrFallback(http.StatusInternalServerError, "failed to get folder", err)
		}
		element.FolderUID = folder.UID
		element.Meta.FolderUID = folder.UID
		element.Meta.FolderName = folder.Title
	}

	return response.JSON(http.StatusOK, model.LibraryElementResponse{Result: element})
}

// swagger:route DELETE /library-elements/{library_element_uid} library_elements deleteLibraryElementByUID
//
// Delete library element.
//
// Deletes an existing library element as specified by the UID. This operation cannot be reverted.
// You cannot delete a library element that is connected. This operation cannot be reverted.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (l *LibraryElementService) deleteHandler(c *contextmodel.ReqContext) response.Response {
	if useKubernetesLibraryPanels(c.Req.Context()) {
		l.k8sHandler.deleteK8sLibraryElement(c)
		return nil // already handled in the k8s handler
	}

	id, err := l.DeleteLibraryElement(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		return l.toLibraryElementError(err, "Failed to delete library element")
	}

	return response.JSON(http.StatusOK, model.DeleteLibraryElementResponse{
		Message: "Library element deleted",
		ID:      id,
	})
}

// swagger:route GET /library-elements/{library_element_uid} library_elements getLibraryElementByUID
//
// Get library element by UID.
//
// Returns a library element with the given UID.
//
// Responses:
// 200: getLibraryElementResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (l *LibraryElementService) getHandler(c *contextmodel.ReqContext) response.Response {
	ctx := c.Req.Context()
	if useKubernetesLibraryPanels(ctx) {
		l.k8sHandler.getK8sLibraryElement(c, l.AccessControl)
		return nil // already handled in the k8s handler
	}

	element, err := l.getLibraryElementByUid(ctx, c.SignedInUser,
		model.GetLibraryElementCommand{
			UID:        web.Params(c.Req)[":uid"],
			FolderName: dashboards.RootFolderName,
		},
		nil,
	)
	if err != nil {
		return l.toLibraryElementError(err, "Failed to get library element")
	}

	allowed, err := l.AccessControl.Evaluate(ctx, c.SignedInUser, ac.EvalPermission(ActionLibraryPanelsRead, ScopeLibraryPanelsProvider.GetResourceScopeUID(web.Params(c.Req)[":uid"])))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "unable to evaluate library panel permissions", err)
	} else if !allowed {
		return response.Error(http.StatusForbidden, "insufficient permissions for getting library panel", err)
	}

	return response.JSON(http.StatusOK, model.LibraryElementResponse{Result: element})
}

// swagger:route GET /library-elements library_elements getLibraryElements
//
// Get all library elements.
//
// Returns a list of all library elements the authenticated user has permission to view.
// Use the `perPage` query parameter to control the maximum number of library elements returned; the default limit is `100`.
// You can also use the `page` query parameter to fetch library elements from any page other than the first one.
//
// Responses:
// 200: getLibraryElementsResponse
// 401: unauthorisedError
// 500: internalServerError
func (l *LibraryElementService) getAllHandler(c *contextmodel.ReqContext) response.Response {
	query := model.SearchLibraryElementsQuery{
		PerPage:          c.QueryInt("perPage"),
		Page:             c.QueryInt("page"),
		SearchString:     c.Query("searchString"),
		SortDirection:    c.Query("sortDirection"),
		Kind:             c.QueryInt("kind"),
		TypeFilter:       c.Query("typeFilter"),
		ExcludeUID:       c.Query("excludeUid"),
		FolderFilter:     c.Query("folderFilter"),
		FolderFilterUIDs: c.Query("folderFilterUIDs"),
	}

	if useKubernetesLibraryPanels(c.Req.Context()) {
		l.k8sHandler.getAllK8sLibraryElements(c, query)
		return nil // already handled in the k8s handler
	}
	// Add cache entry to context for enabling folder tree caching
	c.Req = c.Req.WithContext(withCache(c.Req.Context()))
	elementsResult, err := l.getAllLibraryElements(c.Req.Context(), c.SignedInUser, query)
	if err != nil {
		return l.toLibraryElementError(err, "Failed to get library elements")
	}

	filteredPanels, err := l.filterLibraryPanelsByPermission(c, elementsResult.Elements)
	if err != nil {
		return l.toLibraryElementError(err, "Failed to evaluate permissions")
	}
	elementsResult.Elements = filteredPanels

	return response.JSON(http.StatusOK, model.LibraryElementSearchResponse{Result: elementsResult})
}

// swagger:route PATCH /library-elements/{library_element_uid} library_elements updateLibraryElement
//
// Update library element.
//
// Updates an existing library element identified by uid.
//
// Responses:
// 200: getLibraryElementResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 412: preconditionFailedError
// 500: internalServerError
func (l *LibraryElementService) patchHandler(c *contextmodel.ReqContext) response.Response {
	if useKubernetesLibraryPanels(c.Req.Context()) {
		l.k8sHandler.patchK8sLibraryElement(c)
		return nil // already handled in the k8s handler
	}

	cmd := model.PatchLibraryElementCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if cmd.FolderUID != nil {
		if *cmd.FolderUID == "" {
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
			// nolint:staticcheck
			cmd.FolderID = 0
		} else {
			folder, err := l.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{OrgID: c.GetOrgID(), UID: cmd.FolderUID, SignedInUser: c.SignedInUser})
			if err != nil || folder == nil {
				if errors.Is(err, foldermodel.ErrAccessDenied) {
					return response.Error(http.StatusForbidden, "access denied to folder", err)
				}

				return response.Error(http.StatusBadRequest, "failed to get folder", err)
			}
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
			// nolint:staticcheck
			cmd.FolderID = folder.ID
		}
	}

	element, err := l.PatchLibraryElement(c.Req.Context(), c.SignedInUser, cmd, web.Params(c.Req)[":uid"])
	if err != nil {
		return l.toLibraryElementError(err, "Failed to update library element")
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
	// nolint:staticcheck
	if element.FolderID != 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		// nolint:staticcheck
		folder, err := l.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{OrgID: c.SignedInUser.GetOrgID(), ID: &element.FolderID, SignedInUser: c.SignedInUser})
		if err != nil {
			return response.Error(http.StatusInternalServerError, "failed to get folder", err)
		}
		element.FolderUID = folder.UID
		element.Meta.FolderUID = folder.UID
		element.Meta.FolderName = folder.Title
	}

	return response.JSON(http.StatusOK, model.LibraryElementResponse{Result: element})
}

// swagger:route GET /library-elements/{library_element_uid}/connections/ library_elements getLibraryElementConnections
//
// Get library element connections.
//
// Returns a list of connections for a library element based on the UID specified.
//
// Responses:
// 200: getLibraryElementConnectionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (l *LibraryElementService) getConnectionsHandler(c *contextmodel.ReqContext) response.Response {
	libraryPanelUID := web.Params(c.Req)[":uid"]

	// make sure the library element exists
	var element model.LibraryElementDTO
	if useKubernetesLibraryPanels(c.Req.Context()) {
		dto, ok := l.k8sHandler.fetchK8sLibraryElementDTO(c, libraryPanelUID)
		if !ok {
			return nil // error already handled in the k8s handler
		}
		element = *dto
	} else {
		legacyElement, err := l.getLibraryElementByUid(c.Req.Context(), c.SignedInUser, model.GetLibraryElementCommand{
			UID: libraryPanelUID,
		}, nil)
		if err != nil {
			return l.toLibraryElementError(err, "Failed to get library element")
		}
		element = legacyElement
	}

	// now get all dashboards connected to this library element
	dashboards, err := l.dashboardsService.GetDashboardsByLibraryPanelUID(c.Req.Context(), libraryPanelUID, c.GetOrgID())
	if err != nil {
		return l.toLibraryElementError(err, "Failed to get dashboards")
	}

	connections := make([]model.LibraryElementConnectionDTO, 0)
	for _, dashboard := range dashboards {
		if !c.HasRole(org.RoleAdmin) && !foldermodel.IsRootFolderUID(dashboard.FolderUID) {
			if err := l.requireViewPermissionsOnFolderUID(c.Req.Context(), c.SignedInUser, dashboard.FolderUID); err != nil {
				continue
			}
		}

		// connections are not an individual resource and therefore do not have an id
		// instead, return something that will be consistent and somewhat unique for the connection.
		// note: the connection ID cannot be used to get, update, or delete a connection, so this is solely to keep the api returning the same fields for now,
		// while we deprecate the endpoint.
		hash := fnv.New64a()
		_, err := fmt.Fprintf(hash, "%d:%s:%d:%d", element.ID, dashboard.UID, c.GetOrgID(), element.Meta.Created.Unix())
		if err != nil {
			return l.toLibraryElementError(err, "Failed to generate connection id")
		}
		// ensure it is positive and smaller than 9007199254740991, otherwise we will lose prescision
		// in javascript, which has the safest number as 9007199254740991, compared to 9223372036854775807 in go
		connectionID := int64(hash.Sum64() & ((1 << 52) - 1))

		connections = append(connections, model.LibraryElementConnectionDTO{
			ID:            connectionID,
			Kind:          int64(model.PanelElement),
			ElementID:     element.ID,
			ConnectionID:  dashboard.ID, // nolint:staticcheck
			ConnectionUID: dashboard.UID,
			// returns the creation information of the library element, not the connection
			CreatedBy: model.LibraryElementDTOMetaUser{
				Id:        element.Meta.CreatedBy.Id,
				Name:      element.Meta.CreatedBy.Name,
				AvatarUrl: element.Meta.CreatedBy.AvatarUrl,
			},
			Created: element.Meta.Created,
		})
	}

	return response.JSON(http.StatusOK, model.LibraryElementConnectionsResponse{Result: connections})
}

// swagger:route GET /library-elements/name/{library_element_name} library_elements getLibraryElementByName
//
// Get library element by name.
//
// Returns a library element with the given name.
//
// Responses:
// 200: getLibraryElementArrayResponse
// 401: unauthorisedError
// 404: notFoundError
// 500: internalServerError
func (l *LibraryElementService) getByNameHandler(c *contextmodel.ReqContext) response.Response {
	if useKubernetesLibraryPanels(c.Req.Context()) {
		l.k8sHandler.getByNameK8sLibraryElement(c)
		return nil // already handled in the k8s handler
	}

	elements, err := l.getLibraryElementsByName(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":name"])
	if err != nil {
		return l.toLibraryElementError(err, "Failed to get library element")
	}

	filteredElements, err := l.filterLibraryPanelsByPermission(c, elements)
	if err != nil {
		return l.toLibraryElementError(err, err.Error())
	}

	return response.JSON(http.StatusOK, model.LibraryElementArrayResponse{Result: filteredElements})
}

func (l *LibraryElementService) filterLibraryPanelsByPermission(c *contextmodel.ReqContext, elements []model.LibraryElementDTO) ([]model.LibraryElementDTO, error) {
	filteredPanels := make([]model.LibraryElementDTO, 0)
	// Record each panel's folder so the permission scope resolver can skip the
	// per-panel database lookup it would otherwise do to rediscover the folder.
	ctx := withPanelFolders(c.Req.Context(), elements)
	for _, p := range elements {
		allowed, err := l.AccessControl.Evaluate(ctx, c.SignedInUser, ac.EvalPermission(ActionLibraryPanelsRead, ScopeLibraryPanelsProvider.GetResourceScopeUID(p.UID)))
		if err != nil {
			// This could fail because the folder that contains the library panel does not exist or the user doesn't have permissions to read it.
			// We skip it instead of breaking the library panel list rendering flow and log the error.
			l.log.Warn("Failed to evaluate permissions", "error", err)
			continue
		}
		if allowed {
			filteredPanels = append(filteredPanels, p)
		}
	}

	return filteredPanels, nil
}

func (l *LibraryElementService) toLibraryElementError(err error, message string) response.Response {
	if errors.Is(err, model.ErrLibraryElementAlreadyExists) {
		return response.Error(http.StatusBadRequest, model.ErrLibraryElementAlreadyExists.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementNotFound) {
		return response.Error(http.StatusNotFound, model.ErrLibraryElementNotFound.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementDashboardNotFound) {
		return response.Error(http.StatusNotFound, model.ErrLibraryElementDashboardNotFound.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementVersionMismatch) {
		return response.Error(http.StatusPreconditionFailed, model.ErrLibraryElementVersionMismatch.Error(), err)
	}
	if errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.Error(http.StatusNotFound, dashboards.ErrFolderNotFound.Error(), err)
	}
	if errors.Is(err, foldermodel.ErrAccessDenied) {
		return response.Error(http.StatusForbidden, foldermodel.ErrAccessDenied.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementHasConnections) {
		return response.Error(http.StatusForbidden, model.ErrLibraryElementHasConnections.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementInvalidUID) {
		return response.Error(http.StatusBadRequest, model.ErrLibraryElementInvalidUID.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementUIDTooLong) {
		return response.Error(http.StatusBadRequest, model.ErrLibraryElementUIDTooLong.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementProvisionedFolder) {
		return response.Error(http.StatusConflict, model.ErrLibraryElementProvisionedFolder.Error(), err)
	}
	if errors.Is(err, model.ErrLibraryElementInsufficientPermissions) {
		return response.Error(http.StatusForbidden, err.Error(), err)
	}

	// Log errors that cause internal server error status code.
	l.log.Error(message, "error", err)
	return response.ErrOrFallback(http.StatusInternalServerError, message, err)
}

// swagger:parameters getLibraryElementByUID getLibraryElementConnections
type LibraryElementByUID struct {
	// in:path
	// required:true
	UID string `json:"library_element_uid"`
}

// swagger:parameters getLibraryElementByUID
type GetLibraryElementByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"library_element_uid"`
}

// swagger:parameters GetLibraryElementConnectionsParams
type GetLibraryElementConnectionsParams struct {
	// in:path
	// required:true
	UID string `json:"library_element_uid"`
}

// swagger:parameters deleteLibraryElementByUID
type DeleteLibraryElementByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"library_element_uid"`
}

// swagger:parameters getLibraryElementByName
type LibraryElementByNameParams struct {
	// in:path
	// required:true
	Name string `json:"library_element_name"`
}

// swagger:parameters getLibraryElements
type GetLibraryElementsParams struct {
	// Part of the name or description searched for.
	// in:query
	// required:false
	SearchString string `json:"searchString"`
	// Kind of element to search for.
	// in:query
	// required:false
	// Description:
	// * 1 - library panels
	// enum: 1
	Kind int `json:"kind"`
	// Sort order of elements.
	// in:query
	// required:false
	// Description:
	// * alpha-asc: ascending
	// * alpha-desc: descending
	// Enum: alpha-asc,alpha-desc
	SortDirection string `json:"sortDirection"`
	// A comma separated list of types to filter the elements by
	// in:query
	// required:false
	TypeFilter string `json:"typeFilter"`
	// Element UID to exclude from search results.
	// in:query
	// required:false
	ExcludeUID string `json:"excludeUid"`
	// A comma separated list of folder ID(s) to filter the elements by.
	// Deprecated: Use FolderFilterUIDs instead.
	// in:query
	// required:false
	// deprecated:true
	FolderFilter string `json:"folderFilter"`
	// A comma separated list of folder UID(s) to filter the elements by.
	// in:query
	// required:false
	FolderFilterUIDs string `json:"folderFilterUIDs"`
	// The number of results per page.
	// in:query
	// required:false
	// default: 100
	PerPage int `json:"perPage"`
	// The page for a set of records, given that only perPage records are returned at a time. Numbering starts at 1.
	// in:query
	// required:false
	// default: 1
	Page int `json:"page"`
}

// swagger:parameters createLibraryElement
type CreateLibraryElementParams struct {
	// in:body
	// required:true
	Body model.CreateLibraryElementCommand `json:"body"`
}

// swagger:parameters updateLibraryElement
type UpdateLibraryElementParam struct {
	// in:body
	// required:true
	Body model.PatchLibraryElementCommand `json:"body"`
	// in:path
	// required:true
	UID string `json:"library_element_uid"`
}

// swagger:response getLibraryElementsResponse
type GetLibraryElementsResponse struct {
	// in: body
	Body model.LibraryElementSearchResponse `json:"body"`
}

// swagger:response getLibraryElementResponse
type GetLibraryElementResponse struct {
	// in: body
	Body model.LibraryElementResponse `json:"body"`
}

// swagger:response getLibraryElementArrayResponse
type GetLibraryElementArrayResponse struct {
	// in: body
	Body model.LibraryElementArrayResponse `json:"body"`
}

// swagger:response getLibraryElementConnectionsResponse
type GetLibraryElementConnectionsResponse struct {
	// in: body
	Body model.LibraryElementConnectionsResponse `json:"body"`
}

//-----------------------------------------------------------------------------------------
// Library Elements k8s wrapper functions
//-----------------------------------------------------------------------------------------

type libraryElementsK8sHandler struct {
	cfg                  *setting.Cfg
	namespacer           request.NamespaceMapper
	gvr                  schema.GroupVersionResource
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
	folderService        foldermodel.Service
	dashboardsService    dashboards.DashboardService
	userService          user.Service
}

func newLibraryElementsK8sHandler(cfg *setting.Cfg, clientConfigProvider grafanaapiserver.DirectRestConfigProvider, folderService foldermodel.Service, userService user.Service, dashboardsService dashboards.DashboardService) *libraryElementsK8sHandler {
	gvr := schema.GroupVersionResource{
		Group:    dashboardV0.APIGroup,
		Version:  dashboardV0.APIVersion,
		Resource: dashboardV0.LIBRARY_PANEL_RESOURCE,
	}
	return &libraryElementsK8sHandler{
		cfg:                  cfg,
		gvr:                  gvr,
		namespacer:           request.GetNamespaceMapper(cfg),
		clientConfigProvider: clientConfigProvider,
		folderService:        folderService,
		dashboardsService:    dashboardsService,
		userService:          userService,
	}
}

func (lk8s *libraryElementsK8sHandler) getK8sLibraryElement(c *contextmodel.ReqContext, accessControl ac.AccessControl) {
	uid := web.Params(c.Req)[":uid"]
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}
	serviceCtx, _ := identity.WithServiceIdentity(c.Req.Context(), c.OrgID)
	out, err := client.Get(serviceCtx, uid, v1.GetOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}

	folderUID := out.GetAnnotations()[utils.AnnoKeyFolder]
	authCtx := withPanelFolders(c.Req.Context(), []model.LibraryElementDTO{{UID: uid, FolderUID: folderUID}})
	allowed, err := accessControl.Evaluate(authCtx, c.SignedInUser, ac.EvalPermission(
		ActionLibraryPanelsRead,
		ScopeLibraryPanelsProvider.GetResourceScopeUID(uid),
	))
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "unable to evaluate library panel permissions", err)
		return
	}
	if !allowed {
		c.JsonApiErr(http.StatusForbidden, "insufficient permissions for getting library panel", nil)
		return
	}

	dto, err := lk8s.unstructuredToLegacyLibraryPanelDTO(c, *out)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
		return
	}
	c.JSON(http.StatusOK, model.LibraryElementResponse{Result: *dto})
}

// fetchK8sLibraryElementDTO gets a library panel from the k8s API and converts it to
// the legacy DTO. On failure the error response has already been written and ok is false.
func (lk8s *libraryElementsK8sHandler) fetchK8sLibraryElementDTO(c *contextmodel.ReqContext, uid string) (*model.LibraryElementDTO, bool) {
	client, ok := lk8s.getClient(c)
	if !ok {
		return nil, false
	}
	out, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return nil, false
	}

	dto, err := lk8s.unstructuredToLegacyLibraryPanelDTO(c, *out)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
		return nil, false
	}
	return dto, true
}

func (lk8s *libraryElementsK8sHandler) createK8sLibraryElement(c *contextmodel.ReqContext) {
	cmd := model.CreateLibraryElementCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}
	if model.LibraryElementKind(cmd.Kind) != model.PanelElement {
		c.JsonApiErr(http.StatusBadRequest, model.ErrLibraryElementUnSupportedElementKind.Error(), nil)
		return
	}
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	folderUID := ac.GeneralFolderUID
	switch {
	case cmd.FolderUID != nil:
		folderUID = *cmd.FolderUID
		if folderUID == "" {
			folderUID = ac.GeneralFolderUID
		}
	case cmd.FolderID != 0: // nolint:staticcheck
		var ok bool
		folderUID, ok = lk8s.folderUIDFromLegacyID(c, cmd.FolderID) // nolint:staticcheck
		if !ok {
			return
		}
	}
	obj, err := legacyLibraryPanelToUnstructured(uid, cmd.Name, folderUID, 0, cmd.Model)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "invalid library element model", err)
		return
	}
	out, err := client.Create(c.Req.Context(), obj, v1.CreateOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}
	dto, err := lk8s.unstructuredToLegacyLibraryPanelDTO(c, *out)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
		return
	}
	c.JSON(http.StatusOK, model.LibraryElementResponse{Result: *dto})
}

func (lk8s *libraryElementsK8sHandler) patchK8sLibraryElement(c *contextmodel.ReqContext) {
	cmd := model.PatchLibraryElementCommand{FolderID: -1} // nolint:staticcheck
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}
	if model.LibraryElementKind(cmd.Kind) != model.PanelElement {
		c.JsonApiErr(http.StatusBadRequest, model.ErrLibraryElementUnSupportedElementKind.Error(), nil)
		return
	}
	uid := web.Params(c.Req)[":uid"]
	// renames are delete+create in k8s and are not supported through this wrapper
	if cmd.UID != "" && cmd.UID != uid {
		c.JsonApiErr(http.StatusBadRequest, "changing the uid of a library element is not supported", nil)
		return
	}
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}

	existing, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}
	existingPanel, err := unstructuredToLibraryPanel(existing)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
		return
	}

	// legacy PATCH semantics: name, model, and folderUid all keep their current
	// value when they are absent from the request
	name := cmd.Name
	if name == "" {
		name = existingPanel.Spec.Title
	}
	modelJSON := cmd.Model
	if modelJSON == nil {
		modelJSON, err = LibraryPanelToLegacyModel(existingPanel)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
			return
		}
	}
	folderUID := existing.GetAnnotations()[utils.AnnoKeyFolder]
	switch {
	case cmd.FolderUID != nil:
		folderUID = *cmd.FolderUID
		if folderUID == "" {
			folderUID = ac.GeneralFolderUID
		}
	case cmd.FolderID >= 0: // nolint:staticcheck
		var ok bool
		folderUID, ok = lk8s.folderUIDFromLegacyID(c, cmd.FolderID) // nolint:staticcheck
		if !ok {
			return
		}
	}

	// cmd.Version travels via metadata.generation and carries the legacy
	// optimistic-concurrency check through the k8s update path
	obj, err := legacyLibraryPanelToUnstructured(uid, name, folderUID, cmd.Version, modelJSON)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "invalid library element model", err)
		return
	}
	out, err := client.Update(c.Req.Context(), obj, v1.UpdateOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}
	dto, err := lk8s.unstructuredToLegacyLibraryPanelDTO(c, *out)
	if err != nil {
		c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
		return
	}
	c.JSON(http.StatusOK, model.LibraryElementResponse{Result: *dto})
}

func (lk8s *libraryElementsK8sHandler) deleteK8sLibraryElement(c *contextmodel.ReqContext) {
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}
	uid := web.Params(c.Req)[":uid"]

	// the legacy delete response includes the internal id of the deleted element
	existing, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}
	id := int64(0)
	if meta, err := utils.MetaAccessor(existing); err == nil {
		id = meta.GetDeprecatedInternalID() // nolint:staticcheck
	}

	if err := client.Delete(c.Req.Context(), uid, v1.DeleteOptions{}); err != nil {
		lk8s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.DeleteLibraryElementResponse{
		Message: "Library element deleted",
		ID:      id,
	})
}

// getAllK8sLibraryElements serves GET /api/library-elements from the k8s API.
// Per-item read permissions (including folder inheritance) are enforced by the
// stores themselves: the legacy store evaluates library.panels:read per item and
// unified storage filters through the authz access client. This makes the legacy
// handler's folder-tree post-filtering redundant here, with one deliberate
// difference: a panel the user can read through a direct panel-scoped grant is
// returned even when its parent folder is not viewable, whereas the legacy
// folder-tree filter would hide it.
func (lk8s *libraryElementsK8sHandler) getAllK8sLibraryElements(c *contextmodel.ReqContext, query model.SearchLibraryElementsQuery) {
	if query.PerPage <= 0 {
		query.PerPage = 100
	}
	if query.Page <= 0 {
		query.Page = 1
	}

	folderUIDFilter, ok := lk8s.resolveFolderFilter(c, query)
	if !ok {
		return
	}

	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}
	items, ok := lk8s.listAllK8sLibraryPanels(c, client)
	if !ok {
		return
	}

	filtered := lk8s.filterK8sLibraryPanels(c, items, query, folderUIDFilter)

	sortAsc := query.SortDirection != sort.SortAlphaDesc.Name
	gosort.SliceStable(filtered, func(i, j int) bool {
		iName, _, _ := unstructured.NestedString(filtered[i].Object, "spec", "title")
		jName, _, _ := unstructured.NestedString(filtered[j].Object, "spec", "title")
		if sortAsc {
			return iName < jName
		}
		return iName > jName
	})

	totalCount := int64(len(filtered))
	start := query.PerPage * (query.Page - 1)
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + query.PerPage
	if end > len(filtered) {
		end = len(filtered)
	}

	elements := make([]model.LibraryElementDTO, 0, end-start)
	for _, item := range filtered[start:end] {
		dto, err := lk8s.unstructuredToLegacyLibraryPanelDTO(c, item)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
			return
		}
		elements = append(elements, *dto)
	}

	c.JSON(http.StatusOK, model.LibraryElementSearchResponse{Result: model.LibraryElementSearchResult{
		TotalCount: totalCount,
		Elements:   elements,
		Page:       query.Page,
		PerPage:    query.PerPage,
	}})
}

// filterK8sLibraryPanels applies the legacy search query semantics to the listed
// library panels.
func (lk8s *libraryElementsK8sHandler) filterK8sLibraryPanels(c *contextmodel.ReqContext, items []unstructured.Unstructured, query model.SearchLibraryElementsQuery, folderUIDFilter []string) []unstructured.Unstructured {
	hasFolderFilter := folderUIDFilter != nil
	var typeFilter []string
	if len(strings.TrimSpace(query.TypeFilter)) > 0 {
		typeFilter = strings.Split(query.TypeFilter, ",")
	}
	searchString := strings.ToLower(strings.TrimSpace(query.SearchString))
	matchByFolderTitle := searchString != "" && len(strings.TrimSpace(query.FolderFilterUIDs)) == 0

	// the legacy search also matches elements whose folder title contains the search
	// string unless a folder UID filter is set. The deprecated numeric folder filter
	// still expands matching folder titles before restricting results to those folders.
	folderTitles := map[string]string{}
	if matchByFolderTitle {
		folderTitles = lk8s.resolveFolderTitles(c, items)
	}

	filtered := make([]unstructured.Unstructured, 0, len(items))
	for _, item := range items {
		panelType, _, _ := unstructured.NestedString(item.Object, "spec", "type")
		folderUID := item.GetAnnotations()[utils.AnnoKeyFolder]

		if query.ExcludeUID != "" && item.GetName() == query.ExcludeUID {
			continue
		}
		if len(typeFilter) > 0 && !slices.Contains(typeFilter, panelType) {
			continue
		}
		if hasFolderFilter && !matchesFolderFilter(folderUID, folderUIDFilter) {
			continue
		}
		if !matchesSearchString(item, searchString, folderTitles[folderUID]) {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered
}

// resolveFolderTitles returns the folder title for every distinct folder that
// contains one of the given library panels; unresolvable folders map to "".
func (lk8s *libraryElementsK8sHandler) resolveFolderTitles(c *contextmodel.ReqContext, items []unstructured.Unstructured) map[string]string {
	folderTitles := map[string]string{}
	for _, item := range items {
		folderUID := item.GetAnnotations()[utils.AnnoKeyFolder]
		if folderUID == "" {
			continue
		}
		if _, found := folderTitles[folderUID]; found {
			continue
		}
		if folderUID == ac.GeneralFolderUID {
			folderTitles[folderUID] = dashboards.RootFolderName
			continue
		}
		title := ""
		if folder, err := lk8s.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{
			OrgID:        c.OrgID,
			UID:          &folderUID,
			SignedInUser: c.SignedInUser,
		}); err == nil {
			title = folder.Title
		}
		folderTitles[folderUID] = title
	}
	return folderTitles
}

// matchesFolderFilter mirrors the legacy folder filter: root-level panels match
// via the "general" folder sentinel.
func matchesFolderFilter(folderUID string, folderUIDFilter []string) bool {
	if folderUID == "" {
		return slices.Contains(folderUIDFilter, ac.GeneralFolderUID)
	}
	return slices.Contains(folderUIDFilter, folderUID)
}

// matchesSearchString mirrors the legacy search: the panel matches when its name,
// description, or containing folder title contains the search string.
func matchesSearchString(item unstructured.Unstructured, searchString string, folderTitle string) bool {
	if searchString == "" {
		return true
	}
	name, _, _ := unstructured.NestedString(item.Object, "spec", "title")
	if strings.Contains(strings.ToLower(name), searchString) {
		return true
	}
	description, _, _ := unstructured.NestedString(item.Object, "spec", "description")
	if strings.Contains(strings.ToLower(description), searchString) {
		return true
	}
	return folderTitle != "" && strings.Contains(strings.ToLower(folderTitle), searchString)
}

func (lk8s *libraryElementsK8sHandler) getByNameK8sLibraryElement(c *contextmodel.ReqContext) {
	name := web.Params(c.Req)[":name"]
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}
	items, ok := lk8s.listAllK8sLibraryPanels(c, client)
	if !ok {
		return
	}

	elements := make([]model.LibraryElementDTO, 0)
	for _, item := range items {
		itemName, _, _ := unstructured.NestedString(item.Object, "spec", "title")
		if itemName != name {
			continue
		}
		dto, err := lk8s.unstructuredToLegacyLibraryPanelDTO(c, item)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "conversion error", err)
			return
		}
		elements = append(elements, *dto)
	}
	if len(elements) == 0 {
		c.JsonApiErr(http.StatusNotFound, model.ErrLibraryElementNotFound.Error(), nil)
		return
	}
	c.JSON(http.StatusOK, model.LibraryElementArrayResponse{Result: elements})
}

// resolveFolderFilter converts the legacy folder filter query parameters into a list
// of folder UIDs (the deprecated folderFilter parameter carries folder ids). On
// failure the error response has already been written and ok is false.
func (lk8s *libraryElementsK8sHandler) resolveFolderFilter(c *contextmodel.ReqContext, query model.SearchLibraryElementsQuery) ([]string, bool) {
	hasFolderFilterIDs := len(strings.TrimSpace(query.FolderFilter)) > 0 // nolint:staticcheck
	hasFolderFilterUIDs := len(strings.TrimSpace(query.FolderFilterUIDs)) > 0
	if hasFolderFilterIDs && hasFolderFilterUIDs {
		c.JsonApiErr(http.StatusBadRequest, "cannot pass both folderFilter and folderFilterUIDs", nil)
		return nil, false
	}

	if hasFolderFilterUIDs {
		return strings.Split(query.FolderFilterUIDs, ","), true
	}

	if !hasFolderFilterIDs {
		return nil, true
	}

	folderUIDs := make([]string, 0)
	for _, filter := range strings.Split(query.FolderFilter, ",") { // nolint:staticcheck
		folderID, err := strconv.ParseInt(filter, 10, 64)
		if err != nil {
			c.JsonApiErr(http.StatusBadRequest, "invalid folderFilter", err)
			return nil, false
		}
		if folderID == 0 {
			folderUIDs = append(folderUIDs, ac.GeneralFolderUID)
			continue
		}
		folder, err := lk8s.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{
			OrgID:        c.OrgID,
			ID:           &folderID, // nolint:staticcheck
			SignedInUser: c.SignedInUser,
		})
		if err != nil {
			// unresolvable ids match nothing, same as the legacy SQL filter
			continue
		}
		folderUIDs = append(folderUIDs, folder.UID)
	}
	return folderUIDs, true
}

// listAllK8sLibraryPanels pages through the k8s list endpoint until all library
// panels for the org have been collected. On failure the error response has already
// been written and ok is false.
func (lk8s *libraryElementsK8sHandler) listAllK8sLibraryPanels(c *contextmodel.ReqContext, client dynamic.ResourceInterface) ([]unstructured.Unstructured, bool) {
	items := make([]unstructured.Unstructured, 0)
	opts := v1.ListOptions{Limit: 500}
	for {
		out, err := client.List(c.Req.Context(), opts)
		if err != nil {
			lk8s.writeError(c, err)
			return nil, false
		}
		items = append(items, out.Items...)
		opts.Continue = out.GetContinue()
		if opts.Continue == "" {
			return items, true
		}
	}
}

// legacyLibraryPanelToUnstructured builds the k8s representation of a library panel
// from the fields of a legacy create/patch command.
func legacyLibraryPanelToUnstructured(uid string, name string, folderUID string, version int64, legacyModel json.RawMessage) (*unstructured.Unstructured, error) {
	spec, status, err := LegacyModelToLibraryPanel(name, legacyModel)
	if err != nil {
		return nil, err
	}
	panel := &dashboardV0.LibraryPanel{
		TypeMeta: v1.TypeMeta{
			APIVersion: dashboardV0.APIVERSION,
			Kind:       "LibraryPanel",
		},
		ObjectMeta: v1.ObjectMeta{
			Name: uid,
		},
		Spec:   spec,
		Status: status,
	}
	meta, err := utils.MetaAccessor(panel)
	if err != nil {
		return nil, err
	}
	if folderUID != "" {
		meta.SetFolder(folderUID)
	}
	if version > 0 {
		meta.SetGeneration(version)
	}

	data, err := json.Marshal(panel)
	if err != nil {
		return nil, err
	}
	obj := &unstructured.Unstructured{}
	if err := obj.UnmarshalJSON(data); err != nil {
		return nil, err
	}
	return obj, nil
}

func unstructuredToLibraryPanel(item *unstructured.Unstructured) (*dashboardV0.LibraryPanel, error) {
	data, err := item.MarshalJSON()
	if err != nil {
		return nil, err
	}
	panel := &dashboardV0.LibraryPanel{}
	if err := json.Unmarshal(data, panel); err != nil {
		return nil, fmt.Errorf("failed to unmarshal object into LibraryPanel: %w", err)
	}
	return panel, nil
}

func (lk8s *libraryElementsK8sHandler) unstructuredToLegacyLibraryPanelDTO(c *contextmodel.ReqContext, item unstructured.Unstructured) (*model.LibraryElementDTO, error) {
	panel, err := unstructuredToLibraryPanel(&item)
	if err != nil {
		return nil, err
	}

	id := int64(0)
	folderUID := ""
	meta, err := utils.MetaAccessor(panel)
	if err != nil {
		return nil, err
	}
	id = meta.GetDeprecatedInternalID() // nolint:staticcheck
	folderUID = meta.GetFolder()

	// rebuild the legacy model blob, then re-attach the identifiers the legacy API inlines
	modelJSON, err := LibraryPanelToLegacyModel(panel)
	if err != nil {
		return nil, err
	}
	legacyModel := map[string]any{}
	if err := json.Unmarshal(modelJSON, &legacyModel); err != nil {
		return nil, err
	}
	legacyModel["id"] = id
	legacyModel["libraryPanel"] = map[string]string{
		"name": panel.Spec.Title, // this is the title of the actual library panel, when displayed in the library panel list
		"uid":  item.GetName(),
	}
	finalModel, err := json.Marshal(legacyModel)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	dto := &model.LibraryElementDTO{
		ID:          id,
		OrgID:       c.OrgID,
		FolderUID:   folderUID,
		UID:         item.GetName(),
		Name:        panel.Spec.Title,
		Kind:        int64(model.PanelElement),
		Type:        panel.Spec.Type,
		Description: panel.Spec.Description,
		Model:       finalModel,
		Version:     item.GetGeneration(),
		Meta: model.LibraryElementDTOMeta{
			FolderUID:  folderUID,
			FolderName: dashboards.RootFolderName,
			Created:    meta.GetCreationTimestamp().Time,
		},
	}

	if folderUID != "" && folderUID != ac.GeneralFolderUID {
		dto.Meta.FolderName = ""
		folder, err := lk8s.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{
			OrgID:        c.OrgID,
			UID:          &folderUID,
			SignedInUser: c.SignedInUser,
		})
		if err == nil && folder != nil {
			dto.Meta.FolderName = folder.Title
			dto.FolderID = folder.ID // nolint:staticcheck
		}
	}

	// count connections with a service identity so the result does not depend on the
	// calling user's folder permissions, mirroring enrichConnectedDashboards
	serviceCtx, _ := identity.WithServiceIdentity(c.Req.Context(), c.OrgID)
	dashboards, err := lk8s.dashboardsService.GetDashboardsByLibraryPanelUID(serviceCtx, item.GetName(), c.OrgID)
	if err != nil {
		return nil, err
	}
	dto.Meta.ConnectedDashboards = int64(len(dashboards))

	createdBy := meta.GetCreatedBy()
	updatedBy := createdBy // the old /api returns the same user for updated if it was never updated
	userMeta := []string{createdBy}
	if timestamp, err := meta.GetUpdatedTimestamp(); err == nil && timestamp != nil {
		dto.Meta.Updated = *timestamp
		updatedBy = meta.GetUpdatedBy()
		userMeta = append(userMeta, updatedBy)
	} else {
		// if never updated, the old /api returns the same timestamp for updated as for created
		dto.Meta.Updated = dto.Meta.Created
	}

	users, err := apiserverclient.GetUsersFromMeta(c.Req.Context(), lk8s.userService, userMeta)
	if err != nil {
		return nil, err
	}
	if user := users[createdBy]; user != nil {
		dto.Meta.CreatedBy = model.LibraryElementDTOMetaUser{
			Id:        user.ID,
			Name:      user.Login,
			AvatarUrl: dtos.GetGravatarUrl(lk8s.cfg, user.Email),
		}
	}
	if user := users[updatedBy]; user != nil {
		dto.Meta.UpdatedBy = model.LibraryElementDTOMetaUser{
			Id:        user.ID,
			Name:      user.Login,
			AvatarUrl: dtos.GetGravatarUrl(lk8s.cfg, user.Email),
		}
	}

	return dto, nil
}

//-----------------------------------------------------------------------------------------
// Utility functions
//-----------------------------------------------------------------------------------------

func (lk8s *libraryElementsK8sHandler) getClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
	dyn, err := dynamic.NewForConfig(lk8s.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		c.JsonApiErr(500, "client", err)
		return nil, false
	}
	return dyn.Resource(lk8s.gvr).Namespace(lk8s.namespacer(c.OrgID)), true
}

func (lk8s *libraryElementsK8sHandler) folderUIDFromLegacyID(c *contextmodel.ReqContext, folderID int64) (string, bool) {
	if folderID == 0 {
		return ac.GeneralFolderUID, true
	}
	folder, err := lk8s.folderService.Get(c.Req.Context(), &foldermodel.GetFolderQuery{
		OrgID:        c.OrgID,
		ID:           &folderID, // nolint:staticcheck
		SignedInUser: c.SignedInUser,
	})
	if err != nil || folder == nil {
		if err == nil {
			err = foldermodel.ErrFolderNotFound
		}
		c.JsonApiErr(http.StatusBadRequest, "failed to get folder", err)
		return "", false
	}
	return folder.UID, true
}

func (lk8s *libraryElementsK8sHandler) writeError(c *contextmodel.ReqContext, err error) {
	//nolint:errorlint
	statusError, ok := err.(*k8serrors.StatusError)
	if ok {
		code := int(statusError.Status().Code)
		message := statusError.Status().Message
		// keep the legacy /api contract for errors the k8s apiserver expresses differently
		switch {
		case k8serrors.IsNotFound(err):
			message = model.ErrLibraryElementNotFound.Error()
		case k8serrors.IsAlreadyExists(err):
			code = http.StatusBadRequest
			message = model.ErrLibraryElementAlreadyExists.Error()
		case k8serrors.IsConflict(err) && strings.Contains(message, model.ErrLibraryElementVersionMismatch.Error()):
			code = http.StatusPreconditionFailed
			message = model.ErrLibraryElementVersionMismatch.Error()
		case k8serrors.IsConflict(err) && strings.Contains(message, model.ErrLibraryElementProvisionedFolder.Error()):
			message = model.ErrLibraryElementProvisionedFolder.Error()
		case k8serrors.IsForbidden(err) && strings.Contains(message, model.ErrLibraryElementHasConnections.Error()):
			message = model.ErrLibraryElementHasConnections.Error()
		}
		c.JsonApiErr(code, message, err)
		return
	}
	errhttp.Write(c.Req.Context(), err, c.Resp)
}

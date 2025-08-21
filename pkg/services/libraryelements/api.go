package libraryelements

import (
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"net/http"
	"strings"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

func (l *LibraryElementService) registerAPIEndpoints() {
	authorize := ac.Middleware(l.AccessControl)

	l.RouteRegister.Group("/api/library-elements", func(entities routing.RouteRegister) {
		uidScope := ScopeLibraryPanelsProvider.GetResourceScopeUID(ac.Parameter(":uid"))
		entities.Post("/", authorize(ac.EvalPermission(ActionLibraryPanelsCreate)), routing.Wrap(l.createHandler))
		entities.Delete("/:uid", authorize(ac.EvalPermission(ActionLibraryPanelsDelete, uidScope)), routing.Wrap(l.deleteHandler))
		entities.Get("/", authorize(ac.EvalPermission(ActionLibraryPanelsRead)), routing.Wrap(l.getAllHandler)) // TODO: add wrapper for k8s - requires search
		entities.Get("/:uid", authorize(ac.EvalPermission(ActionLibraryPanelsRead)), routing.Wrap(l.getHandler))
		entities.Get("/:uid/connections/", authorize(ac.EvalPermission(ActionLibraryPanelsRead, uidScope)), routing.Wrap(l.getConnectionsHandler))
		entities.Get("/name/:name", routing.Wrap(l.getByNameHandler)) // TODO: add wrapper for k8s - requires search
		entities.Patch("/:uid", authorize(ac.EvalPermission(ActionLibraryPanelsWrite, uidScope)), routing.Wrap(l.patchHandler))
	})
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
	if l.features.IsEnabled(c.Req.Context(), featuremgmt.FlagKubernetesLibraryPanels) {
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
			folder, err := l.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.GetOrgID(), UID: cmd.FolderUID, SignedInUser: c.SignedInUser})
			if err != nil || folder == nil {
				return response.ErrOrFallback(http.StatusBadRequest, "failed to get folder", err)
			}
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
			// nolint:staticcheck
			cmd.FolderID = folder.ID
		}
	}

	element, err := l.createLibraryElement(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return l.toLibraryElementError(err, "Failed to create library element")
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
	// nolint:staticcheck
	if element.FolderID != 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		// nolint:staticcheck
		folder, err := l.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.SignedInUser.GetOrgID(), ID: &element.FolderID, SignedInUser: c.SignedInUser})
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
	if l.features.IsEnabled(c.Req.Context(), featuremgmt.FlagKubernetesLibraryPanels) {
		l.k8sHandler.deleteK8sLibraryElement(c)
		return nil // already handled in the k8s handler
	}

	id, err := l.deleteLibraryElement(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
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
	if l.features.IsEnabled(c.Req.Context(), featuremgmt.FlagKubernetesLibraryPanels) {
		l.k8sHandler.getK8sLibraryElement(c)
		return nil // already handled in the k8s handler
	}

	ctx := c.Req.Context()
	element, err := l.getLibraryElementByUid(ctx, c.SignedInUser,
		model.GetLibraryElementCommand{
			UID:        web.Params(c.Req)[":uid"],
			FolderName: dashboards.RootFolderName,
		},
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
	if l.features.IsEnabled(c.Req.Context(), featuremgmt.FlagKubernetesLibraryPanels) {
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
			folder, err := l.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.GetOrgID(), UID: cmd.FolderUID, SignedInUser: c.SignedInUser})
			if err != nil || folder == nil {
				if errors.Is(err, dashboards.ErrFolderAccessDenied) {
					return response.Error(http.StatusForbidden, "access denied to folder", err)
				}

				return response.Error(http.StatusBadRequest, "failed to get folder", err)
			}
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
			// nolint:staticcheck
			cmd.FolderID = folder.ID
		}
	}

	element, err := l.patchLibraryElement(c.Req.Context(), c.SignedInUser, cmd, web.Params(c.Req)[":uid"])
	if err != nil {
		return l.toLibraryElementError(err, "Failed to update library element")
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
	// nolint:staticcheck
	if element.FolderID != 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		// nolint:staticcheck
		folder, err := l.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.SignedInUser.GetOrgID(), ID: &element.FolderID, SignedInUser: c.SignedInUser})
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
	element, err := l.getLibraryElementByUid(c.Req.Context(), c.SignedInUser, model.GetLibraryElementCommand{
		UID: libraryPanelUID,
	})
	if err != nil {
		return l.toLibraryElementError(err, "Failed to get library element")
	}

	// now get all dashboards connected to this library element
	dashboards, err := l.dashboardsService.GetDashboardsByLibraryPanelUID(c.Req.Context(), libraryPanelUID, c.GetOrgID())
	if err != nil {
		return l.toLibraryElementError(err, "Failed to get dashboards")
	}

	ids, err := l.getConnectionIDs(c.Req.Context(), c.SignedInUser, libraryPanelUID)
	if err != nil {
		return l.toLibraryElementError(err, "Failed to get connection ids")
	}

	connections := make([]model.LibraryElementConnectionDTO, 0)
	for _, dashboard := range dashboards {
		// skip checks if the user is an admin, or if the dashboard is in the general folder
		if !c.HasRole(org.RoleAdmin) && dashboard.FolderUID != "" && dashboard.FolderUID != "general" {
			if err := l.requireViewPermissionsOnFolderUID(c.Req.Context(), c.SignedInUser, dashboard.FolderUID); err != nil {
				continue
			}
		}

		// best effort to get a connection id, once in unified storage, connections are not an individual resource and therefore do not have an id
		connectionID, ok := ids[getConnectionKey(element.ID, dashboard.ID)] // nolint:staticcheck
		if !ok {
			// if we cannot get an ID from the db, instead do a best effort to return something that will be consistent and somewhat unique for the connection.
			// note: the connection ID cannot be used to get, update, or delete a connection, so this is solely to keep the api returning the same fields for now,
			// while we deprecate the endpoint.
			hash := fnv.New64a()
			_, err := fmt.Fprintf(hash, "%d:%s:%d:%d", element.ID, dashboard.UID, c.GetOrgID(), element.Meta.Created.Unix())
			if err != nil {
				return l.toLibraryElementError(err, "Failed to generate connection id")
			}
			// ensure it is positive and smaller than 9007199254740991, otherwise we will lose prescision
			// in javascript, which has the safest number as 9007199254740991, compared to 9223372036854775807 in go
			connectionID = int64(hash.Sum64() & ((1 << 52) - 1))
		}

		connections = append(connections, model.LibraryElementConnectionDTO{
			ID:            connectionID,
			Kind:          int64(model.PanelElement),
			ElementID:     element.ID,
			ConnectionID:  dashboard.ID, // nolint:staticcheck
			ConnectionUID: dashboard.UID,
			// returns the creation information of the library element, not the connection
			CreatedBy: librarypanel.LibraryElementDTOMetaUser{
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
	for _, p := range elements {
		allowed, err := l.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, ac.EvalPermission(ActionLibraryPanelsRead, ScopeLibraryPanelsProvider.GetResourceScopeUID(p.UID)))
		if err != nil {
			return nil, err
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
	if errors.Is(err, dashboards.ErrFolderAccessDenied) {
		return response.Error(http.StatusForbidden, dashboards.ErrFolderAccessDenied.Error(), err)
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
	if err != nil && strings.Contains(err.Error(), "insufficient permissions") {
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
	// in:query
	// required:false
	FolderFilter string `json:"folderFilter"`
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
	folderService        folder.Service
	dashboardsService    dashboards.DashboardService
	userService          user.Service
}

func newLibraryElementsK8sHandler(cfg *setting.Cfg, clientConfigProvider grafanaapiserver.DirectRestConfigProvider, folderService folder.Service, userService user.Service, dashboardsService dashboards.DashboardService) *libraryElementsK8sHandler {
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

func (lk8s *libraryElementsK8sHandler) getK8sLibraryElement(c *contextmodel.ReqContext) {
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}
	uid := web.Params(c.Req)[":uid"]
	out, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
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

func (lk8s *libraryElementsK8sHandler) createK8sLibraryElement(c *contextmodel.ReqContext) {
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}

	cmd := model.CreateLibraryElementCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}

	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}

	libraryPanelSpec, err := lk8s.legacyModelToLibraryPanelSpec(c, cmd)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "failed to convert model", err)
		return
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": dashboardV0.APIVERSION,
			"kind":       "LibraryPanel",
			"metadata": map[string]interface{}{
				"name": cmd.UID,
			},
			"spec": libraryPanelSpec,
		},
	}

	meta, err := utils.MetaAccessor(obj)
	if cmd.FolderUID != nil && *cmd.FolderUID != "" {
		if err == nil {
			meta.SetFolder(*cmd.FolderUID)
		}
	}
	meta.SetCreatedBy(c.SignedInUser.UserUID)

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

// TODO:
// - authorization in mode 4+, when the library element will no longer exist
// - patching the library elements
// - folder ID inserts
// - handle errors better (for example, try to create a library panel with the same name of one that aleady exists)
// - test moving folders
func (lk8s *libraryElementsK8sHandler) legacyModelToLibraryPanelSpec(c *contextmodel.ReqContext, cmd model.CreateLibraryElementCommand) (*dashboardV0.LibraryPanelSpec, error) {
	var modelMap map[string]interface{}
	if err := json.Unmarshal(cmd.Model, &modelMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal model: %w", err)
	}

	libraryPanelSpec := dashboardV0.LibraryPanelSpec{
		Title: cmd.Name,
	}

	if description, ok := modelMap["description"].(string); ok {
		libraryPanelSpec.Description = description
	}

	if panelTitle, ok := modelMap["title"].(string); ok {
		libraryPanelSpec.PanelTitle = panelTitle
	}

	if t, ok := modelMap["type"].(string); ok {
		libraryPanelSpec.Type = t
	}

	if options, ok := modelMap["options"].(map[string]interface{}); ok {
		libraryPanelSpec.Options.SetUnstructuredContent(options)
	}

	if fieldConfig, ok := modelMap["fieldConfig"].(map[string]interface{}); ok {
		libraryPanelSpec.FieldConfig.SetUnstructuredContent(fieldConfig)
	}

	if pluginVersion, ok := modelMap["pluginVersion"].(string); ok {
		libraryPanelSpec.PluginVersion = pluginVersion
	}

	if datasource, ok := modelMap["datasource"]; ok && datasource != nil {
		datasourceJSON, err := json.Marshal(datasource)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal datasource: %w", err)
		}
		var datasourceRef data.DataSourceRef
		if err := json.Unmarshal(datasourceJSON, &datasourceRef); err != nil {
			return nil, fmt.Errorf("failed to unmarshal datasource: %w", err)
		}
		libraryPanelSpec.Datasource = &datasourceRef
	}

	if gridPos, ok := modelMap["gridPos"]; ok && gridPos != nil {
		gridPosJSON, err := json.Marshal(gridPos)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal gridPos: %w", err)
		}
		var gridPosStruct dashboardV0.GridPos
		if err := json.Unmarshal(gridPosJSON, &gridPosStruct); err != nil {
			return nil, fmt.Errorf("failed to unmarshal gridPos: %w", err)
		}
		libraryPanelSpec.GridPos = gridPosStruct
	}

	if transparent, ok := modelMap["transparent"].(bool); ok {
		libraryPanelSpec.Transparent = transparent
	}

	if links, ok := modelMap["links"].([]interface{}); ok && len(links) > 0 {
		libraryPanelSpec.Links = make([]common.Unstructured, len(links))
		for i, link := range links {
			if linkMap, ok := link.(map[string]interface{}); ok {
				libraryPanelSpec.Links[i].SetUnstructuredContent(linkMap)
			}
		}
	}

	if targets, ok := modelMap["targets"].([]interface{}); ok && len(targets) > 0 {
		targetsJSON, err := json.Marshal(targets)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal targets: %w", err)
		}
		var targetsStruct []data.DataQuery
		if err := json.Unmarshal(targetsJSON, &targetsStruct); err != nil {
			return nil, fmt.Errorf("failed to unmarshal targets: %w", err)
		}
		libraryPanelSpec.Targets = targetsStruct
	}

	return &libraryPanelSpec, nil
}

func (lk8s *libraryElementsK8sHandler) deleteK8sLibraryElement(c *contextmodel.ReqContext) {
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}

	// we need to get the library element before deleting to return the proper api response
	uid := web.Params(c.Req)[":uid"]
	deleted, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}

	meta, err := utils.MetaAccessor(deleted)
	if err != nil {
		lk8s.writeError(c, err)
		return
	}

	meta.SetUpdatedBy(c.SignedInUser.UserUID)

	err = client.Delete(c.Req.Context(), uid, v1.DeleteOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}

	c.JSON(http.StatusOK, model.DeleteLibraryElementResponse{
		Message: "Library element deleted",
		ID:      meta.GetDeprecatedInternalID(), // nolint:staticcheck
	})
}

func (lk8s *libraryElementsK8sHandler) patchK8sLibraryElement(c *contextmodel.ReqContext) {
	client, ok := lk8s.getClient(c)
	if !ok {
		return
	}

	uid := web.Params(c.Req)[":uid"]
	cmd := model.PatchLibraryElementCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		c.JsonApiErr(http.StatusBadRequest, "bad request data", err)
		return
	}

	// Get the existing library element
	existing, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		lk8s.writeError(c, err)
		return
	}

	meta, err := utils.MetaAccessor(existing)
	if cmd.FolderUID != nil {
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "failed to access metadata", err)
			return
		}
		meta.SetFolder(*cmd.FolderUID)
	}

	meta.SetUpdatedBy(c.SignedInUser.UserUID)

	if cmd.Model != nil {
		libraryPanelSpec, err := lk8s.legacyModelToLibraryPanelSpec(c, model.CreateLibraryElementCommand{
			Name:  cmd.Name,
			Model: cmd.Model,
		})
		if err != nil {
			c.JsonApiErr(http.StatusBadRequest, "failed to convert model", err)
			return
		}
		specJSON, err := json.Marshal(libraryPanelSpec)
		if err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "failed to marshal spec", err)
			return
		}
		var specMap map[string]interface{}
		if err := json.Unmarshal(specJSON, &specMap); err != nil {
			c.JsonApiErr(http.StatusInternalServerError, "failed to unmarshal spec", err)
			return
		}
		existing.Object["spec"] = libraryPanelSpec
	}

	out, err := client.Update(c.Req.Context(), existing, v1.UpdateOptions{})
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

func (lk8s *libraryElementsK8sHandler) unstructuredToLegacyLibraryPanelDTO(c *contextmodel.ReqContext, item unstructured.Unstructured) (*model.LibraryElementDTO, error) {
	spec, exists := item.Object["spec"].(map[string]interface{})
	if !exists {
		return nil, fmt.Errorf("spec not found in unstructured object")
	}

	id := int64(0)
	folderUID := ""
	meta, err := utils.MetaAccessor(&item)
	if err == nil {
		id = meta.GetDeprecatedInternalID() // nolint:staticcheck
		folderUID = meta.GetFolder()
	}

	var libraryPanelSpec dashboardV0.LibraryPanelSpec
	specJSON, err := json.Marshal(spec)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal spec: %w", err)
	}

	err = json.Unmarshal(specJSON, &libraryPanelSpec)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal spec into LibraryPanelSpec: %w", err)
	}

	// need to reconstruct this section from what we have in the k8s object
	legacyModel := map[string]any{}
	legacyModel["datasource"] = libraryPanelSpec.Datasource
	legacyModel["description"] = libraryPanelSpec.Description
	legacyModel["fieldConfig"] = libraryPanelSpec.FieldConfig.Object
	legacyModel["gridPos"] = libraryPanelSpec.GridPos
	legacyModel["id"] = id
	legacyModel["options"] = libraryPanelSpec.Options.Object
	legacyModel["pluginVersion"] = libraryPanelSpec.PluginVersion
	legacyModel["type"] = libraryPanelSpec.Type
	legacyModel["title"] = libraryPanelSpec.PanelTitle // this is the title of the panel when displayed in the dashboard
	legacyModel["libraryPanel"] = map[string]string{
		"name": libraryPanelSpec.Title, // this is the title of the actual library panel, when displayed in the library panel list
		"uid":  item.GetName(),
	}
	if len(libraryPanelSpec.Links) > 0 {
		legacyModel["links"] = libraryPanelSpec.Links
	}
	if len(libraryPanelSpec.Targets) > 0 {
		legacyModel["targets"] = libraryPanelSpec.Targets
	}
	if libraryPanelSpec.Transparent {
		legacyModel["transparent"] = libraryPanelSpec.Transparent
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
		Name:        libraryPanelSpec.Title,
		Kind:        int64(model.PanelElement),
		Type:        libraryPanelSpec.Type,
		Description: libraryPanelSpec.Description,
		Model:       finalModel,
		Version:     item.GetGeneration(),
		Meta: model.LibraryElementDTOMeta{
			FolderUID: folderUID,
			Created:   meta.GetCreationTimestamp().Time,
		},
	}

	if folderUID != "" {
		folder, err := lk8s.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{
			OrgID:        c.OrgID,
			UID:          &folderUID,
			SignedInUser: c.SignedInUser,
		})
		if err != nil {
			return nil, err
		}

		dto.Meta.FolderName = folder.Title
		dto.FolderID = folder.ID // nolint:staticcheck
	}

	dashboards, err := lk8s.dashboardsService.GetDashboardsByLibraryPanelUID(c.Req.Context(), item.GetName(), c.OrgID)
	if err != nil {
		return nil, err
	}
	dto.Meta.ConnectedDashboards = int64(len(dashboards))

	createdBy := meta.GetCreatedBy()
	updatedBy := createdBy // the old /api returns the same user for updated if it was never updated
	userUIDs := []string{meta.GetCreatedBy()}
	if timestamp, err := meta.GetUpdatedTimestamp(); err == nil && timestamp != nil {
		dto.Meta.Updated = *timestamp
		updatedBy = meta.GetUpdatedBy()
		userUIDs = append(userUIDs, updatedBy)
	} else {
		// if never updated, the old /api returns the same timestamp for updated as for created
		dto.Meta.Updated = dto.Meta.Created
	}

	users, err := lk8s.userService.ListByIdOrUID(c.Req.Context(), userUIDs, []int64{c.OrgID})
	if err != nil {
		return nil, err
	}
	for _, user := range users {
		if user.UID == createdBy {
			dto.Meta.CreatedBy = librarypanel.LibraryElementDTOMetaUser{
				Id:        user.ID,
				Name:      user.Login,
				AvatarUrl: dtos.GetGravatarUrl(lk8s.cfg, user.Email),
			}
		}
		// not else because /api returns the same user for updated if it was never updated
		if user.UID == updatedBy {
			dto.Meta.UpdatedBy = librarypanel.LibraryElementDTOMetaUser{
				Id:        user.ID,
				Name:      user.Login,
				AvatarUrl: dtos.GetGravatarUrl(lk8s.cfg, user.Email),
			}
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

func (lk8s *libraryElementsK8sHandler) writeError(c *contextmodel.ReqContext, err error) {
	//nolint:errorlint
	statusError, ok := err.(*k8serrors.StatusError)
	if ok {
		c.JsonApiErr(int(statusError.Status().Code), statusError.Status().Message, err)
		return
	}
	errhttp.Write(c.Req.Context(), err, c.Resp)
}

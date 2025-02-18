package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

const REDACTED = "redacted"

func (hs *HTTPServer) registerFolderAPI(apiRoute routing.RouteRegister, authorize func(accesscontrol.Evaluator) web.Handler) {
	// #TODO add back auth part
	apiRoute.Group("/folders", func(folderRoute routing.RouteRegister) {
		idScope := dashboards.ScopeFoldersProvider.GetResourceScope(accesscontrol.Parameter(":id"))
		uidScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.Parameter(":uid"))
		folderRoute.Get("/id/:id", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, idScope)), routing.Wrap(hs.GetFolderByID))

		folderRoute.Group("/:uid", func(folderUidRoute routing.RouteRegister) {
			folderUidRoute.Group("/permissions", func(folderPermissionRoute routing.RouteRegister) {
				folderPermissionRoute.Get("/", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, uidScope)), routing.Wrap(hs.GetFolderPermissionList))
				folderPermissionRoute.Post("/", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, uidScope)), routing.Wrap(hs.UpdateFolderPermissions))
			})
		})

		folderRoute.Post("/", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersCreate)), routing.Wrap(hs.CreateFolder))
		folderRoute.Get("/", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersRead)), routing.Wrap(hs.GetFolders))
		folderRoute.Group("/:uid", func(folderUidRoute routing.RouteRegister) {
			folderUidRoute.Put("/", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, uidScope)), routing.Wrap(hs.UpdateFolder))
			folderUidRoute.Delete("/", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, uidScope)), routing.Wrap(hs.DeleteFolder))
			folderUidRoute.Get("/", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, uidScope)), routing.Wrap(hs.GetFolderByUID))
			folderUidRoute.Get("/counts", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, uidScope)), routing.Wrap(hs.GetFolderDescendantCounts))
			folderUidRoute.Post("/move", authorize(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, uidScope)), routing.Wrap(hs.MoveFolder))
		})
	})
}

// swagger:route GET /folders folders getFolders
//
// Get all folders.
//
// It returns all folders that the authenticated user has permission to view.
// If nested folders are enabled, it expects an additional query parameter with the parent folder UID
// and returns the immediate subfolders that the authenticated user has permission to view.
// If the parameter is not supplied then it returns immediate subfolders under the root
// that the authenticated user has permission to view.
//
// Responses:
// 200: getFoldersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetFolders(c *contextmodel.ReqContext) response.Response {
	permission := dashboardaccess.PERMISSION_VIEW
	if c.Query("permission") == "Edit" {
		permission = dashboardaccess.PERMISSION_EDIT
	}

	if hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagNestedFolders) {
		q := &folder.GetChildrenQuery{
			OrgID:        c.SignedInUser.GetOrgID(),
			Limit:        c.QueryInt64("limit"),
			Page:         c.QueryInt64("page"),
			UID:          c.Query("parentUid"),
			Permission:   permission,
			SignedInUser: c.SignedInUser,
		}

		folders, err := hs.folderService.GetChildren(c.Req.Context(), q)
		if err != nil {
			return apierrors.ToFolderErrorResponse(err)
		}

		hits := make([]dtos.FolderSearchHit, 0)
		for _, f := range folders {
			hits = append(hits, dtos.FolderSearchHit{
				ID:         f.ID, // nolint:staticcheck
				UID:        f.UID,
				Title:      f.Title,
				ParentUID:  f.ParentUID,
				Repository: f.Repository,
			})
			metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetFolders).Inc()
		}

		return response.JSON(http.StatusOK, hits)
	}

	hits, err := hs.searchFolders(c, permission)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	return response.JSON(http.StatusOK, hits)
}

// swagger:route GET /folders/{folder_uid} folders getFolderByUID
//
// Get folder by uid.
//
// Responses:
// 200: folderResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetFolderByUID(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.SignedInUser.GetOrgID(), UID: &uid, SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	folderDTO, err := hs.newToFolderDto(c, folder)
	if err != nil {
		return response.Err(err)
	}

	return response.JSON(http.StatusOK, folderDTO)
}

// swagger:route GET /folders/id/{folder_id} folders getFolderByID
//
// Get folder by id.
//
// Returns the folder identified by id. This is deprecated.
// Please refer to [updated API](#/folders/getFolderByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: folderResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetFolderByID(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetFolderByID).Inc()
	// nolint:staticcheck
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{ID: &id, OrgID: c.SignedInUser.GetOrgID(), SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	folderDTO, err := hs.newToFolderDto(c, folder)
	if err != nil {
		return response.Err(err)
	}
	return response.JSON(http.StatusOK, folderDTO)
}

// swagger:route POST /folders folders createFolder
//
// Create folder.
//
// If nested folders are enabled then it additionally expects the parent folder UID.
//
// Responses:
// 200: folderResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) CreateFolder(c *contextmodel.ReqContext) response.Response {
	cmd := folder.CreateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.SignedInUser.GetOrgID()
	cmd.SignedInUser = c.SignedInUser

	folder, err := hs.folderService.Create(c.Req.Context(), &cmd)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	if err := hs.setDefaultFolderPermissions(c.Req.Context(), cmd.OrgID, cmd.SignedInUser, folder); err != nil {
		hs.log.Error("Could not set the default folder permissions", "folder", folder.Title, "user", cmd.SignedInUser, "error", err)
	}

	// Clear permission cache for the user who's created the folder, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly created object
	hs.accesscontrolService.ClearUserPermissionCache(c.SignedInUser)

	folderDTO, err := hs.newToFolderDto(c, folder)
	if err != nil {
		return response.Err(err)
	}

	// TODO set ParentUID if nested folders are enabled
	return response.JSON(http.StatusOK, folderDTO)
}

func (hs *HTTPServer) setDefaultFolderPermissions(ctx context.Context, orgID int64, user identity.Requester, folder *folder.Folder) error {
	if !hs.Cfg.RBAC.PermissionsOnCreation("folder") {
		return nil
	}

	var permissions []accesscontrol.SetResourcePermissionCommand

	if user.IsIdentityType(claims.TypeUser) {
		userID, err := user.GetInternalID()
		if err != nil {
			return err
		}

		permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
			UserID: userID, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
		})
	}

	isNested := folder.ParentUID != ""
	if !isNested || !hs.Features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	_, err := hs.folderPermissionsService.SetPermissions(ctx, orgID, folder.UID, permissions...)
	return err
}

// swagger:route POST /folders/{folder_uid}/move folders moveFolder
//
// Move folder.
//
// Responses:
// 200: folderResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) MoveFolder(c *contextmodel.ReqContext) response.Response {
	if hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagNestedFolders) {
		cmd := folder.MoveFolderCommand{}
		if err := web.Bind(c.Req, &cmd); err != nil {
			return response.Error(http.StatusBadRequest, "bad request data", err)
		}
		var err error

		cmd.OrgID = c.SignedInUser.GetOrgID()
		cmd.UID = web.Params(c.Req)[":uid"]
		cmd.SignedInUser = c.SignedInUser
		theFolder, err := hs.folderService.Move(c.Req.Context(), &cmd)
		if err != nil {
			return response.ErrOrFallback(http.StatusInternalServerError, "move folder failed", err)
		}

		folderDTO, err := hs.newToFolderDto(c, theFolder)
		if err != nil {
			return response.Err(err)
		}
		return response.JSON(http.StatusOK, folderDTO)
	}
	result := map[string]string{}
	result["message"] = "To use this service, you need to activate nested folder feature."
	return response.JSON(http.StatusNotFound, result)
}

// swagger:route PUT /folders/{folder_uid} folders updateFolder
//
// Update folder.
//
// Responses:
// 200: folderResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) UpdateFolder(c *contextmodel.ReqContext) response.Response {
	cmd := folder.UpdateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	cmd.OrgID = c.SignedInUser.GetOrgID()
	cmd.UID = web.Params(c.Req)[":uid"]
	cmd.SignedInUser = c.SignedInUser
	result, err := hs.folderService.Update(c.Req.Context(), &cmd)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}
	folderDTO, err := hs.newToFolderDto(c, result)
	if err != nil {
		return response.Err(err)
	}

	return response.JSON(http.StatusOK, folderDTO)
}

// swagger:route DELETE /folders/{folder_uid} folders deleteFolder
//
// Delete folder.
//
// Deletes an existing folder identified by UID along with all dashboards (and their alerts) stored in the folder. This operation cannot be reverted.
// If nested folders are enabled then it also deletes all the subfolders.
//
// Responses:
// 200: deleteFolderResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteFolder(c *contextmodel.ReqContext) response.Response { // temporarily adding this function to HTTPServer, will be removed from HTTPServer when librarypanels featuretoggle is removed
	err := hs.LibraryElementService.DeleteLibraryElementsInFolder(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		if errors.Is(err, model.ErrFolderHasConnectedLibraryElements) {
			return response.Error(http.StatusForbidden, "Folder could not be deleted because it contains library elements in use", err)
		}
		return apierrors.ToFolderErrorResponse(err)
	}
	/* TODO: after a decision regarding folder deletion permissions has been made
	(https://github.com/grafana/grafana-enterprise/issues/5144),
	remove the previous call to hs.LibraryElementService.DeleteLibraryElementsInFolder
	and remove "user" from the signature of DeleteInFolder in the folder RegistryService.
	Context: https://github.com/grafana/grafana/pull/69149#discussion_r1235057903
	*/

	uid := web.Params(c.Req)[":uid"]
	err = hs.folderService.Delete(c.Req.Context(), &folder.DeleteFolderCommand{UID: uid, OrgID: c.SignedInUser.GetOrgID(), ForceDeleteRules: c.QueryBool("forceDeleteRules"), SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Folder deleted",
	})
}

// swagger:route GET /folders/{folder_uid}/counts folders getFolderDescendantCounts
//
// Gets the count of each descendant of a folder by kind. The folder is identified by UID.
//
// Responses:
// 200: getFolderDescendantCountsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetFolderDescendantCounts(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	counts, err := hs.folderService.GetDescendantCounts(c.Req.Context(), &folder.GetDescendantCountsQuery{OrgID: c.SignedInUser.GetOrgID(), UID: &uid, SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	return response.JSON(http.StatusOK, counts)
}
func (hs *HTTPServer) newToFolderDto(c *contextmodel.ReqContext, f *folder.Folder) (dtos.Folder, error) {
	ctx := c.Req.Context()
	toDTO := func(f *folder.Folder, checkCanView bool) (dtos.Folder, error) {
		g, err := guardian.NewByFolder(c.Req.Context(), f, c.SignedInUser.GetOrgID(), c.SignedInUser)
		if err != nil {
			return dtos.Folder{}, err
		}

		canEdit, _ := g.CanEdit()
		canSave, _ := g.CanSave()
		canAdmin, _ := g.CanAdmin()
		canDelete, _ := g.CanDelete()

		// Finding creator and last updater of the folder
		updater, creator := anonString, anonString
		if f.CreatedBy > 0 {
			creator = hs.getIdentityName(ctx, f.OrgID, f.CreatedBy)
		}
		if f.UpdatedBy > 0 {
			updater = hs.getIdentityName(ctx, f.OrgID, f.UpdatedBy)
		}

		acMetadata, _ := hs.getFolderACMetadata(c, f)

		if checkCanView {
			canView, _ := g.CanView()
			if !canView {
				return dtos.Folder{
					UID:   REDACTED,
					Title: REDACTED,
				}, nil
			}
		}
		metrics.MFolderIDsAPICount.WithLabelValues(metrics.NewToFolderDTO).Inc()
		return dtos.Folder{
			ID:            f.ID, // nolint:staticcheck
			UID:           f.UID,
			OrgID:         f.OrgID,
			Title:         f.Title,
			URL:           f.URL,
			HasACL:        f.HasACL,
			CanSave:       canSave,
			CanEdit:       canEdit,
			CanAdmin:      canAdmin,
			CanDelete:     canDelete,
			CreatedBy:     creator,
			Created:       f.Created,
			UpdatedBy:     updater,
			Updated:       f.Updated,
			Version:       f.Version,
			AccessControl: acMetadata,
			ParentUID:     f.ParentUID,
			Repository:    f.Repository,
		}, nil
	}

	// no need to check view permission for the starting folder since it's already checked by the callers
	folderDTO, err := toDTO(f, false)
	if err != nil {
		return dtos.Folder{}, err
	}

	if !hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagNestedFolders) {
		return folderDTO, nil
	}

	parents, err := hs.folderService.GetParents(ctx, folder.GetParentsQuery{UID: f.UID, OrgID: f.OrgID})
	if err != nil {
		// log the error instead of failing
		hs.log.Error("failed to fetch folder parents", "folder", f.UID, "org", f.OrgID, "error", err)
	}

	folderDTO.Parents = make([]dtos.Folder, 0, len(parents))
	for _, f := range parents {
		DTO, err := toDTO(f, true)
		if err != nil {
			hs.log.Error("failed to convert folder to DTO", "folder", f.UID, "org", f.OrgID, "error", err)
			continue
		}
		folderDTO.Parents = append(folderDTO.Parents, DTO)
	}

	return folderDTO, nil
}

func (hs *HTTPServer) getFolderACMetadata(c *contextmodel.ReqContext, f *folder.Folder) (accesscontrol.Metadata, error) {
	if !c.QueryBool("accesscontrol") {
		return nil, nil
	}

	parents, err := hs.folderService.GetParents(c.Req.Context(), folder.GetParentsQuery{UID: f.UID, OrgID: c.SignedInUser.GetOrgID()})
	if err != nil {
		return nil, err
	}

	folderIDs := map[string]bool{f.UID: true}
	for _, p := range parents {
		folderIDs[p.UID] = true
	}

	allMetadata := getMultiAccessControlMetadata(c, dashboards.ScopeFoldersPrefix, folderIDs)
	metadata := map[string]bool{}
	// Flatten metadata - if any parent has a permission, the child folder inherits it
	for _, md := range allMetadata {
		for action := range md {
			metadata[action] = true
		}
	}
	return metadata, nil
}

func (hs *HTTPServer) searchFolders(c *contextmodel.ReqContext, permission dashboardaccess.PermissionType) ([]dtos.FolderSearchHit, error) {
	searchQuery := search.Query{
		SignedInUser: c.SignedInUser,
		DashboardIds: make([]int64, 0),
		FolderIds:    make([]int64, 0), // nolint:staticcheck
		Limit:        c.QueryInt64("limit"),
		OrgId:        c.SignedInUser.GetOrgID(),
		Type:         "dash-folder",
		Permission:   permission,
		Page:         c.QueryInt64("page"),
	}

	hits, err := hs.SearchService.SearchHandler(c.Req.Context(), &searchQuery)
	if err != nil {
		return nil, err
	}

	folderHits := make([]dtos.FolderSearchHit, 0)
	for _, hit := range hits {
		folderHits = append(folderHits, dtos.FolderSearchHit{
			ID:    hit.ID, // nolint:staticcheck
			UID:   hit.UID,
			Title: hit.Title,
		})
		metrics.MFolderIDsAPICount.WithLabelValues(metrics.SearchFolders).Inc()
	}

	return folderHits, nil
}

// swagger:parameters getFolders
type GetFoldersParams struct {
	// Limit the maximum number of folders to return
	// in:query
	// required:false
	// default:1000
	Limit int64 `json:"limit"`
	// Page index for starting fetching folders
	// in:query
	// required:false
	// default:1
	Page int64 `json:"page"`
	// The parent folder UID
	// in:query
	// required:false
	ParentUID string `json:"parentUid"`
	// Set to `Edit` to return folders that the user can edit
	// in:query
	// required: false
	// default:View
	// Enum: Edit,View
	Permission string `json:"permission"`
}

// swagger:parameters getFolderByUID
type GetFolderByUIDParams struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
}

// swagger:parameters updateFolder
type UpdateFolderParams struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
	// To change the unique identifier (uid), provide another one.
	// To overwrite an existing folder with newer version, set `overwrite` to `true`.
	// Provide the current version to safelly update the folder: if the provided version differs from the stored one the request will fail, unless `overwrite` is `true`.
	//
	// in:body
	// required:true
	Body folder.UpdateFolderCommand `json:"body"`
}

// swagger:parameters getFolderByID
type GetFolderByIDParams struct {
	// in:path
	// required:true
	//
	// Deprecated: use FolderUID instead
	FolderID int64 `json:"folder_id"`
}

// swagger:parameters createFolder
type CreateFolderParams struct {
	// in:body
	// required:true
	Body folder.CreateFolderCommand `json:"body"`
}

// swagger:parameters moveFolder
type MoveFolderParams struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
	// in:body
	// required:true
	Body folder.MoveFolderCommand `json:"body"`
}

// swagger:parameters deleteFolder
type DeleteFolderParams struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
	// If `true` any Grafana 8 Alerts under this folder will be deleted.
	// Set to `false` so that the request will fail if the folder contains any Grafana 8 Alerts.
	// in:query
	// required:false
	// default:false
	ForceDeleteRules bool `json:"forceDeleteRules"`
}

// swagger:response getFoldersResponse
type GetFoldersResponse struct {
	// The response message
	// in: body
	Body []dtos.FolderSearchHit `json:"body"`
}

// swagger:response folderResponse
type FolderResponse struct {
	// The response message
	// in: body
	Body dtos.Folder `json:"body"`
}

// swagger:response deleteFolderResponse
type DeleteFolderResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the deleted folder.
		// required: true
		// example: 65
		ID int64 `json:"id"`

		// Title of the deleted folder.
		// required: true
		// example: My Folder
		Title string `json:"title"`

		// Message Message of the deleted folder.
		// required: true
		// example: Folder My Folder deleted
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:parameters getFolderDescendantCounts
type GetFolderDescendantCountsParams struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
}

// swagger:response getFolderDescendantCountsResponse
type GetFolderDescendantCountsResponse struct {
	// The response message
	// in: body
	Body folder.DescendantCounts `json:"body"`
}

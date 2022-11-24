package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /folders folders getFolders
//
// Get all folders.
//
// Returns all folders that the authenticated user has permission to view.
//
// Responses:
// 200: getFoldersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetFolders(c *models.ReqContext) response.Response {
	folders, err := hs.folderService.GetFolders(c.Req.Context(), c.SignedInUser, c.OrgID, c.QueryInt64("limit"), c.QueryInt64("page"))

	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	uids := make(map[string]bool, len(folders))
	result := make([]dtos.FolderSearchHit, 0)
	for _, f := range folders {
		uids[f.Uid] = true
		result = append(result, dtos.FolderSearchHit{
			Id:    f.Id,
			Uid:   f.Uid,
			Title: f.Title,
		})
	}

	metadata := hs.getMultiAccessControlMetadata(c, c.OrgID, dashboards.ScopeFoldersPrefix, uids)
	if len(metadata) > 0 {
		for i := range result {
			result[i].AccessControl = metadata[result[i].Uid]
		}
	}

	return response.JSON(http.StatusOK, result)
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
func (hs *HTTPServer) GetFolderByUID(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{OrgID: c.OrgID, UID: &uid, SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), folder.ID, c.OrgID, c.SignedInUser)
	return response.JSON(http.StatusOK, hs.newToFolderDto(c, g, folder))
}

// swagger:route GET /folders/id/{folder_id} folders getFolderByID
//
// Get folder by id.
//
// Returns the folder identified by id.
//
// Responses:
// 200: folderResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetFolderByID(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	folder, err := hs.folderService.Get(c.Req.Context(), &folder.GetFolderQuery{ID: &id, OrgID: c.OrgID, SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), folder.ID, c.OrgID, c.SignedInUser)
	return response.JSON(http.StatusOK, hs.newToFolderDto(c, g, folder))
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
func (hs *HTTPServer) CreateFolder(c *models.ReqContext) response.Response {
	cmd := folder.CreateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.OrgID
	cmd.SignedInUser = c.SignedInUser

	folder, err := hs.folderService.Create(c.Req.Context(), &cmd)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), folder.ID, c.OrgID, c.SignedInUser)
	// TODO set ParentUID if nested folders are enabled
	return response.JSON(http.StatusOK, hs.newToFolderDto(c, g, folder))
}

func (hs *HTTPServer) MoveFolder(c *models.ReqContext) response.Response {
	if hs.Features.IsEnabled(featuremgmt.FlagNestedFolders) {
		cmd := models.MoveFolderCommand{}
		if err := web.Bind(c.Req, &cmd); err != nil {
			return response.Error(http.StatusBadRequest, "bad request data", err)
		}
		var theFolder *folder.Folder
		var err error
		if cmd.ParentUID != nil {
			moveCommand := folder.MoveFolderCommand{
				UID:          web.Params(c.Req)[":uid"],
				NewParentUID: *cmd.ParentUID,
				OrgID:        c.OrgID,
			}
			theFolder, err = hs.folderService.Move(c.Req.Context(), &moveCommand)
			if err != nil {
				return response.Error(http.StatusInternalServerError, "update folder uid failed", err)
			}
		}
		return response.JSON(http.StatusOK, theFolder)
	}
	result := map[string]string{}
	result["message"] = "To use this service, you need to activate nested folder feature."
	return response.JSON(http.StatusNotFound, result)
}

// swagger:route PUT /folders/{folder_uid} folders updateFolder
//
// Update folder.
//
// If nested folders are enabled then it optionally expects a new parent folder UID that moves the folder and
// includes it into the response.
//
// Responses:
// 200: folderResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) UpdateFolder(c *models.ReqContext) response.Response {
	cmd := models.UpdateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	result, err := hs.folderService.Update(c.Req.Context(), c.SignedInUser, c.OrgID, web.Params(c.Req)[":uid"], &cmd)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}
	g := guardian.New(c.Req.Context(), result.ID, c.OrgID, c.SignedInUser)
	return response.JSON(http.StatusOK, hs.newToFolderDto(c, g, result))
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
func (hs *HTTPServer) DeleteFolder(c *models.ReqContext) response.Response { // temporarily adding this function to HTTPServer, will be removed from HTTPServer when librarypanels featuretoggle is removed
	err := hs.LibraryElementService.DeleteLibraryElementsInFolder(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		if errors.Is(err, libraryelements.ErrFolderHasConnectedLibraryElements) {
			return response.Error(403, "Folder could not be deleted because it contains library elements in use", err)
		}
		return apierrors.ToFolderErrorResponse(err)
	}

	uid := web.Params(c.Req)[":uid"]
	err = hs.folderService.DeleteFolder(c.Req.Context(), &folder.DeleteFolderCommand{UID: uid, OrgID: c.OrgID, ForceDeleteRules: c.QueryBool("forceDeleteRules"), SignedInUser: c.SignedInUser})
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	return response.JSON(http.StatusOK, "")
}

func (hs *HTTPServer) newToFolderDto(c *models.ReqContext, g guardian.DashboardGuardian, folder *folder.Folder) dtos.Folder {
	canEdit, _ := g.CanEdit()
	canSave, _ := g.CanSave()
	canAdmin, _ := g.CanAdmin()
	canDelete, _ := g.CanDelete()

	// Finding creator and last updater of the folder
	updater, creator := anonString, anonString
	if folder.CreatedBy > 0 {
		creator = hs.getUserLogin(c.Req.Context(), folder.CreatedBy)
	}
	if folder.UpdatedBy > 0 {
		updater = hs.getUserLogin(c.Req.Context(), folder.UpdatedBy)
	}

	return dtos.Folder{
		Id:            folder.ID,
		Uid:           folder.UID,
		Title:         folder.Title,
		Url:           folder.Url,
		HasACL:        folder.HasACL,
		CanSave:       canSave,
		CanEdit:       canEdit,
		CanAdmin:      canAdmin,
		CanDelete:     canDelete,
		CreatedBy:     creator,
		Created:       folder.Created,
		UpdatedBy:     updater,
		Updated:       folder.Updated,
		Version:       folder.Version,
		AccessControl: hs.getAccessControlMetadata(c, c.OrgID, dashboards.ScopeFoldersPrefix, folder.UID),
		ParentUID:     folder.ParentUID,
	}
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
	Body models.UpdateFolderCommand `json:"body"`
}

// swagger:parameters getFolderByID
type GetFolderByIDParams struct {
	// in:path
	// required:true
	FolderID int64 `json:"folder_id"`
}

// swagger:parameters createFolder
type CreateFolderParams struct {
	// in:body
	// required:true
	Body folder.CreateFolderCommand `json:"body"`
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

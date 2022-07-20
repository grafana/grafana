package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
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

// swagger:route GET /folders/{folder_uid} folders getFolderByUID
//
// Get folder by uid.
//
// Responses:
// 200:
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /folders folders createFolder
//
// Create folder.
//
// Responses:
// 200: folderResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError

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

// swagger:route DELETE /folders/{folder_uid} folders deleteFolder
//
// Delete folder.
//
// Deletes an existing folder identified by UID along with all dashboards (and their alerts) stored in the folder. This operation cannot be reverted.
//
// Responses:
// 200: deleteFolderResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

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

// swagger:parameters getFolderByUID updateFolder deleteFolder
// swagger:parameters getFolderPermissions
type FolderUIDParam struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
}

// swagger:parameters updateFolderPermissions
type PostDashboardPermissionsParam struct {
	// in:path
	// required:true
	FolderUID string `json:"folder_uid"`
	// in:body
	// required:true
	Body dtos.UpdateDashboardACLCommand
}

// swagger:parameters getFolderByID
type FolderIDParam struct {
	// in:path
	// required:true
	FolderID int64 `json:"folder_id"`
}

// swagger:parameters createFolder
type CreateFolderParam struct {
	// in:body
	// required:true
	Body models.CreateFolderCommand `json:"body"`
}

// swagger:parameters updateFolder
type UpdateFolderParam struct {
	// To change the unique identifier (uid), provide another one.
	// To overwrite an existing folder with newer version, set `overwrite` to `true`.
	// Provide the current version to safelly update the folder: if the provided version differs from the stored one the request will fail, unless `overwrite` is `true`.
	//
	// in:body
	// required:true
	Body models.UpdateFolderCommand `json:"body"`
}

// swagger:parameters deleteFolder
type DeleteFolderParam struct {
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

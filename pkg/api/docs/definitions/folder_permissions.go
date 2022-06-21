package definitions

// swagger:route GET /folders/{folder_uid}/permissions folder_permissions getFolderPermissions
//
// Gets all existing permissions for the folder with the given `uid`.
//
// Responses:
// 200: getDashboardPermissionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /folders/{folder_uid}/permissions folder_permissions updateFolderPermissions
//
// Updates permissions for a folder. This operation will remove existing permissions if they’re not included in the request.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

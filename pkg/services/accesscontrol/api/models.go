package api

// This file contains the swagger descriptions of the parameters and reponses
// associated with the access-control API endpoints.

// swagger:parameters searchPermissions
type SearchPermissionsParams struct {
	// in:query
	// required:false
	UserId int64 `json:"userId"`

	// in:query
	// required:false
	UserLogin string `json:"userLogin"`

	// in:query
	// required:false
	ActionPrefix string `json:"actionPrefix"`

	// in:query
	// required:false
	Action string `json:"action"`

	// in:query
	// required:false
	Scope string `json:"scope"`
}

// Scopes
//
// List of scopes.
//
// example: ["teams:id:1", "teams:id:2"]
type Scopes []string

// PermissionsByAction
//
// Permissions with scopes grouped by action.
//
// example: {"teams.read": ["teams:id:1", "teams:id:2"]}
type PermissionsByAction map[string]Scopes

// swagger:response searchPermissionsResponse
type SearchPermissionsResponse struct {
	// UsersPermissionsByAction
	//
	// Permissions grouped by userID.
	//
	// in: body
	// example: { 1: {"teams.read": ["teams:id:1", "teams:id:2"]}, 3: {"teams.read": ["teams:id:3"]}}
	Body map[int64]PermissionsByAction `json:"body"`
}

package api

// This file contains the swagger descriptions of the parameters and reponses
// associated with the access-control API endpoints.

// swagger:parameters searchPermissions
type SearchPermissionsParams struct {
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

type Scopes []string

type PermissionsByAction map[string]Scopes

type UsersPermissions map[int64]PermissionsByAction

// swagger:response searchPermissionsResponse
type SearchPermissionsResponse struct {
	// in: body
	Body UsersPermissions `json:"body"`
}

// swagger:parameters searchUserPermissions
type SearchUserPermissionsParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`

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

// swagger:response searchUserPermissionsResponse
type SearchUserPermissionsResponse struct {
	// in: body
	Body PermissionsByAction `json:"body"`
}

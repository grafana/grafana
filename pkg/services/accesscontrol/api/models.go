package api

// This file contains the swagger descriptions of the parameters and reponses
// associated with the access-control API endpoints.

// swagger:parameters searchPermissions
type SearchPermissionsParams struct {
	// in:query
	// example: 12
	// required:false
	UserId int64 `json:"userId"`

	// in:query
	// example: "viewer1"
	// required:false
	UserLogin string `json:"userLogin"`

	// in:query
	// example: "teams:"
	// required:false
	ActionPrefix string `json:"actionPrefix"`

	// in:query
	// example: "teams:read"
	// required:false
	Action string `json:"action"`

	// in:query
	// example: "teams:id:1"
	// required:false
	Scope string `json:"scope"`
}

// swagger:response searchPermissionsResponse
type SearchPermissionsResponse struct {

	// User permissions grouped by user ID, with scopes grouped by action.
	// example: { "1": { "teams.read": [ "teams:id:1", "teams:id:2" ] }, "3": { "teams.read": [ "teams:id:3" ] } }
	// in: body
	Body map[string]map[string][]string `json:"body"`
}

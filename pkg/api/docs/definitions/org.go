package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

// swagger:route GET /org current_org_details getOrg
//
// Get current Organization
//
// Responses:
// 200: getOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /org/users current_org_details getOrgUsers
//
// Get all users within the current organization.
//
// Returns all org users within the current organization. Accessible to users with org admin role.
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:read` with scope `users:*`.
//
// Responses:
// 200: getOrgUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /org/users/lookup current_org_details lookupOrgUsers
//
// Get all users within the current organization (lookup)
//
// Returns all org users within the current organization, but with less detailed information.
// Accessible to users with org admin role, admin in any folder or admin of any team.
// Mainly used by Grafana UI for providing list of users when adding team members and when editing folder/dashboard permissions.
//
// Responses:
// 200: lookupOrgUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PATCH /org/users/{user_id} current_org_details updateOrgUser
//
// Updates the given user
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users.role:update` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /org/users/{user_id} current_org_details deleteOrgUser
//
// Delete user in current organization
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:remove` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PUT /org current_org_details updateOrg
//
// Update current Organization.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PUT /org/address current_org_details updateOrgAddress
//
// Update current Organization's address.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /org/users current_org_details addOrgUser
//
// Add a new user to the current organization
//
// Adds a global user to the current organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:add` with scope `users:*`.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:parameters updateOrgAddress
type UpdateOrgAddressParams struct {
	// in:body
	// required:true
	Body dtos.UpdateOrgAddressForm `json:"body"`
}

// swagger:parameters updateOrgUser
type UpdateOrgUserParams struct {
	// in:body
	// required:true
	Body models.UpdateOrgUserCommand `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters deleteOrgUser
type DeleteOrgUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters updateOrg
type UpdateOrgParams struct {
	// in:body
	// required:true
	Body dtos.UpdateOrgForm `json:"body"`
}

// swagger:parameters addOrgUser
type AddOrgUserParams struct {
	// in:body
	// required:true
	Body models.AddOrgUserCommand `json:"body"`
}

// swagger:parameters lookupOrgUsers
type LookupOrgUsersParams struct {
	// in:query
	// required:false
	Query string `json:"query"`
	// in:query
	// required:false
	Limit int `json:"limit"`
}

// swagger:response getOrgResponse
type GetOrgResponse struct {
	// The response message
	// in: body
	Body models.OrgDetailsDTO `json:"body"`
}

// swagger:response getOrgUsersResponse
type GetOrgUsersResponse struct {
	// The response message
	// in: body
	Body []*models.OrgUserDTO `json:"body"`
}

// swagger:response lookupOrgUsersResponse
type LookupOrgUsersResponse struct {
	// The response message
	// in: body
	Body []*dtos.UserLookupDTO `json:"body"`
}

// swagger:response addOrgUser
type AddOrgUser struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the added user.
		// required: true
		// example: 65
		UsedID int64 `json:"id"`

		// Message Message of the added user.
		// required: true
		// example: Data source added
		Message string `json:"message"`
	} `json:"body"`
}

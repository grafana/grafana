package definitions

import "github.com/grafana/grafana/pkg/models"

// swagger:route GET /orgs/{org_id} orgs getOrgByID
//
// Get Organization by ID.
//
// Security:
// - basic:
//
// Responses:
// 200: getOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /orgs/name/{org_name} orgs getOrgByName
//
// Get Organization by ID.
//
// Security:
// - basic:
//
// Responses:
// 200: getOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /orgs orgs createOrg
//
// Create Organization.
//
// Only works if [users.allow_org_create](https://grafana.com/docs/grafana/latest/administration/configuration/#allow_org_create) is set.
//
// Responses:
// 200: createOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError

// swagger:route GET /orgs orgs searchOrg
//
// Search all Organizations
//
// Security:
// - basic:
//
// Responses:
// 200: searchOrgResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError

// swagger:route PUT /orgs/{org_id} orgs adminUpdateOrg
//
// Update Organization.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PUT /orgs/{org_id}/address orgs adminUpdateOrgAddress
//
// Update Organization's address.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /orgs/{org_id} orgs adminDeleteOrg
//
// Delete Organization.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /orgs/{org_id}/users orgs adminGetOrgUsers
//
// Get Users in Organization.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `org.users:read` with scope `users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: getOrgUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /orgs/{org_id}/users orgs adminAddOrgUser
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

// swagger:route PATCH /orgs/{org_id}/users/{user_id} orgs adminUpdateOrgUser
//
// Update Users in Organization.
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

// swagger:route DELETE /orgs/{org_id}/users/{user_id} orgs adminDeleteOrgUser
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

// swagger:route GET /orgs/{org_id}/quotas orgs getOrgQuota
//
// Fetch Organization quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `orgs.quotas:read` and scope `org:id:1` (orgIDScope).
//list
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route PUT /orgs/{org_id}/quotas/{quota_target} orgs updateOrgQuota
//
// Update user quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `orgs.quotas:write` and scope `org:id:1` (orgIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters getOrgByID adminUpdateOrg adminUpdateOrgAddress adminDeleteOrg adminGetOrgUsers
// swagger:parameters adminAddOrgUser adminUpdateOrgUser adminDeleteOrgUser
// swagger:parameters getOrgQuota updateOrgQuota userSetUsingOrg
type OrgIDParam struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters getOrgByName
type OrgNameParam struct {
	// in:path
	// required:true
	OrgName string `json:"org_name"`
}

// swagger:parameters createOrg
type CreateOrgParam struct {
	// in:body
	// required:true
	Body models.CreateOrgCommand `json:"body"`
}

// swagger:parameters searchOrg searchTeams
type SearchOrgParams struct {
	// in:query
	// required:false
	// default: 1
	Page int `json:"page"`
	// Number of items per page
	// The totalCount field in the response can be used for pagination list E.g. if totalCount is equal to 100 teams and the perpage parameter is set to 10 then there are 10 pages of teams.
	// in:query
	// required:false
	// default: 1000
	PerPage int    `json:"perpage"`
	Name    string `json:"name"`
	// If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded.
	// required:false
	Query string `json:"query"`
}

// swagger:parameters updateOrgQuota
type UpdateOrgQuotaParam struct {
	// in:body
	// required:true
	Body models.UpdateOrgQuotaCmd `json:"body"`
}

// swagger:response createOrgResponse
type CreateOrgResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the created org.
		// required: true
		// example: 65
		OrgID int64 `json:"orgId"`

		// Message Message of the created org.
		// required: true
		// example: Data source added
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response searchOrgResponse
type SearchOrgResponse struct {
	// The response message
	// in: body
	Body []*models.OrgDTO `json:"body"`
}

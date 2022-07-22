package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

// swagger:route GET /org/invites org_invites getInvites
//
// Get pending invites.
//
// Responses:
// 200: getInvitesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /org/invites org_invites addInvite
//
// Add invite.
//
// Responses:
// 200: addOrgUser
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 412: SMTPNotEnabledError
// 500: internalServerError

// swagger:route DELETE /org/{invitation_code}/invites org_invites revokeInvite
//
// Revoke invite.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters addInvite
type AddInviteParams struct {
	// in:body
	// required:true
	Body dtos.AddInviteForm `json:"body"`
}

// swagger:parameters revokeInvite
type RevokeInviteParams struct {
	// in:path
	// required:true
	Code string `json:"invitation_code"`
}

// swagger:response getInvitesResponse
type GetInvitesResponse struct {
	// The response message
	// in: body
	Body []*models.TempUserDTO `json:"body"`
}

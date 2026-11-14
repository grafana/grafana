package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patpolicy"
	"github.com/grafana/grafana/pkg/web"
)

// PersonalAccessTokenPolicyDTO is the admin view of the personal access token switch.
type PersonalAccessTokenPolicyDTO struct {
	Enabled bool `json:"enabled"`
	// ManagedByConfig is true when the instance switch can only be changed in the configuration file.
	ManagedByConfig bool `json:"managedByConfig"`
}

// UpdatePersonalAccessTokenPolicyCommand changes the switch.
type UpdatePersonalAccessTokenPolicyCommand struct {
	Enabled bool `json:"enabled"`
	// RevokeExisting permanently revokes existing tokens; only applies when disabling.
	RevokeExisting bool `json:"revokeExisting"`
}

// UpdatePersonalAccessTokenPolicyResponse reports how many tokens were revoked.
type UpdatePersonalAccessTokenPolicyResponse struct {
	PersonalAccessTokenPolicyDTO
	Revoked int64 `json:"revoked"`
}

func (hs *HTTPServer) patPolicyActor(c *contextmodel.ReqContext) patpolicy.Actor {
	return patpolicy.Actor{UserID: c.SignedInUser.UserID, OrgID: c.GetOrgID(), IP: hs.patClientIP(c)}
}

// swagger:route GET /admin/settings/personal-access-tokens admin getInstancePersonalAccessTokenPolicy
//
// Get the instance-wide personal access token switch.
//
// Responses:
// 200: personalAccessTokenPolicyResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetInstancePersonalAccessTokenPolicy(c *contextmodel.ReqContext) response.Response {
	st, err := hs.personalTokenPolicy.GetInstance(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to read policy", err)
	}
	return response.JSON(http.StatusOK, PersonalAccessTokenPolicyDTO{Enabled: st.Enabled, ManagedByConfig: st.ManagedByConfig})
}

// swagger:route PUT /admin/settings/personal-access-tokens admin updateInstancePersonalAccessTokenPolicy
//
// Enable or disable personal access tokens for the instance.
//
// Responses:
// 200: updatePersonalAccessTokenPolicyResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateInstancePersonalAccessTokenPolicy(c *contextmodel.ReqContext) response.Response {
	cmd := UpdatePersonalAccessTokenPolicyCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	revoked, err := hs.personalTokenPolicy.SetInstance(c.Req.Context(), hs.patPolicyActor(c), cmd.Enabled, cmd.RevokeExisting)
	if errors.Is(err, patpolicy.ErrManagedByConfig) {
		return response.Error(http.StatusForbidden, "Personal access tokens are managed by configuration", nil)
	}
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update policy", err)
	}
	return response.JSON(http.StatusOK, UpdatePersonalAccessTokenPolicyResponse{
		PersonalAccessTokenPolicyDTO: PersonalAccessTokenPolicyDTO{Enabled: cmd.Enabled}, Revoked: revoked})
}

// swagger:route GET /org/settings/personal-access-tokens org getOrgPersonalAccessTokenPolicy
//
// Get the personal access token switch of the current organization.
//
// Responses:
// 200: personalAccessTokenPolicyResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgPersonalAccessTokenPolicy(c *contextmodel.ReqContext) response.Response {
	st, err := hs.personalTokenPolicy.GetOrg(c.Req.Context(), c.GetOrgID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to read policy", err)
	}
	return response.JSON(http.StatusOK, PersonalAccessTokenPolicyDTO{Enabled: st.Enabled})
}

// swagger:route PUT /org/settings/personal-access-tokens org updateOrgPersonalAccessTokenPolicy
//
// Enable or disable personal access tokens for the current organization.
//
// An organization can only narrow what the instance allows.
//
// Responses:
// 200: updatePersonalAccessTokenPolicyResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrgPersonalAccessTokenPolicy(c *contextmodel.ReqContext) response.Response {
	cmd := UpdatePersonalAccessTokenPolicyCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	revoked, err := hs.personalTokenPolicy.SetOrg(c.Req.Context(), hs.patPolicyActor(c), c.GetOrgID(), cmd.Enabled, cmd.RevokeExisting)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update policy", err)
	}
	return response.JSON(http.StatusOK, UpdatePersonalAccessTokenPolicyResponse{
		PersonalAccessTokenPolicyDTO: PersonalAccessTokenPolicyDTO{Enabled: cmd.Enabled}, Revoked: revoked})
}

// swagger:response personalAccessTokenPolicyResponse
type personalAccessTokenPolicyResponse struct {
	// in:body
	Body PersonalAccessTokenPolicyDTO `json:"body"`
}

// swagger:response updatePersonalAccessTokenPolicyResponse
type updatePersonalAccessTokenPolicyResponse struct {
	// in:body
	Body UpdatePersonalAccessTokenPolicyResponse `json:"body"`
}

// swagger:parameters updateInstancePersonalAccessTokenPolicy updateOrgPersonalAccessTokenPolicy
type updatePersonalAccessTokenPolicyParams struct {
	// in:body
	// required:true
	Body UpdatePersonalAccessTokenPolicyCommand `json:"body"`
}

// swagger:route GET /user/tokens-policy signed_in_user getEffectivePersonalAccessTokenPolicy
//
// Whether personal access tokens can currently be created in the active organization.
//
// Responses:
// 200: personalAccessTokenPolicyResponse
// 401: unauthorisedError
// 403: forbiddenError
func (hs *HTTPServer) GetEffectivePersonalAccessTokenPolicy(c *contextmodel.ReqContext) response.Response {
	inst, err := hs.personalTokenPolicy.GetInstance(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to read policy", err)
	}
	return response.JSON(http.StatusOK, PersonalAccessTokenPolicyDTO{
		Enabled:         hs.personalTokenPolicy.OrgEnabled(c.Req.Context(), c.GetOrgID()),
		ManagedByConfig: inst.ManagedByConfig,
	})
}

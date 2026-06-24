package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// credentialEnrollBeginRequest is the body for starting passwordless signup enrollment. It mirrors the
// signup step-2 form minus the password: the account is created with no password and a passkey becomes
// its only credential.
type credentialEnrollBeginRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Username string `json:"username"`
	OrgName  string `json:"orgName"`
	Code     string `json:"code"`
}

// CredentialEnrollBegin creates a passwordless user from a signup and starts a WebAuthn registration
// ceremony. It mirrors SignUpStep2's account creation but sets no password and, instead of completing
// signup inline, returns the WebAuthn options + an enrollment-token sessionID that CredentialEnrollFinish
// (PW6) consumes to persist the credential and log the user in. Anonymous endpoint.
func (hs *HTTPServer) CredentialEnrollBegin(c *contextmodel.ReqContext) response.Response {
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, maxPreAuthFormBodySize)

	form := credentialEnrollBeginRequest{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if !hs.Cfg.AllowUserSignUp {
		return response.Error(http.StatusUnauthorized, "User signup is disabled", nil)
	}
	// Guard before creating the user so a misconfigured instance doesn't leave a passwordless,
	// passkey-less (locked-out) account behind.
	if !hs.Cfg.Passkey.Enabled {
		return response.Error(http.StatusBadRequest, "Passkey auth is not enabled", nil)
	}

	// No Password: the account is passwordless; a passkey will be its only credential.
	createUserCmd := user.CreateUserCommand{
		Email:   form.Email,
		Login:   form.Username,
		Name:    form.Name,
		OrgName: form.OrgName,
	}
	// Email verification only applies when the operator enabled it (needs SMTP); the code is the
	// proof-of-inbox trust anchor in that case. Mirrors SignUpStep2.
	if hs.Cfg.VerifyEmailEnabled {
		if ok, rsp := hs.verifyUserSignUpEmail(c.Req.Context(), form.Email, form.Code); !ok {
			return rsp
		}
		createUserCmd.EmailVerified = true
	}

	usr, err := hs.userService.Create(c.Req.Context(), &createUserCmd)
	if err != nil {
		if errors.Is(err, user.ErrUserAlreadyExists) {
			return response.Error(http.StatusUnauthorized, "User with same email address already exists", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to create user", err)
	}

	displayName := form.Name
	if displayName == "" {
		displayName = form.Username
	}
	res, err := hs.passkeyService.BeginEnrollment(c.Req.Context(), passkey.RegisteringUser{
		UserID:      usr.ID,
		Name:        form.Username,
		DisplayName: displayName,
	}, passkey.EnrollSourceSignup)
	if err != nil {
		return mapPasskeyError(err)
	}
	return response.JSON(http.StatusOK, passkeyBeginResponse{SessionID: res.SessionID, Options: res.Options})
}

// credentialEnrollFinishRequest is the body posted to finish an anonymous enrollment: the sessionID
// from begin, a user-chosen credential name, and the raw attestation the authenticator produced.
type credentialEnrollFinishRequest struct {
	SessionID string          `json:"sessionID"`
	Name      string          `json:"name"`
	Response  json.RawMessage `json:"response"`
}

// CredentialEnrollFinish verifies the attestation against the pending enrollment, persists the new
// credential, and logs the user in — completing passwordless signup. Anonymous endpoint.
func (hs *HTTPServer) CredentialEnrollFinish(c *contextmodel.ReqContext) response.Response {
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, maxPreAuthFormBodySize)

	form := credentialEnrollFinishRequest{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	userID, _, err := hs.passkeyService.FinishEnrollment(c.Req.Context(), form.SessionID, form.Name, form.Response)
	if err != nil {
		if errors.Is(err, passkey.ErrChallengeExpired) {
			return response.Error(http.StatusGone, "passkey.challenge-expired", err)
		}
		return response.Error(http.StatusBadRequest, "passkey enrollment failed", err)
	}
	// Source-specific post-steps (completing the signup/invite TempUser, applying invite org) are
	// deferred; PW7 wires the invite branch.

	usr, err := hs.userService.GetByID(c.Req.Context(), &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to load enrolled user", err)
	}
	if err := hs.loginUserWithUser(usr, c); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to login user", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "Signed up", "code": "redirect-to-landing-page"})
}

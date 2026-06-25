package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/metrics"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/passkey"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
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
		if !errors.Is(err, user.ErrUserAlreadyExists) {
			return response.Error(http.StatusInternalServerError, "Failed to create user", err)
		}
		// The email may belong to an abandoned passwordless signup (a user row a previous begin created
		// before its WebAuthn ceremony finished). Reuse that row if it is provably unusable; otherwise
		// it is a real account and the email is taken.
		usr, err = hs.reclaimAbandonedPasswordlessUser(c.Req.Context(), form.Email)
		if err != nil {
			return response.Error(http.StatusUnauthorized, "User with same email address already exists", nil)
		}
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

	userID, source, err := hs.passkeyService.FinishEnrollment(c.Req.Context(), form.SessionID, form.Name, form.Response)
	if err != nil {
		if errors.Is(err, passkey.ErrChallengeExpired) {
			return response.Error(http.StatusGone, "passkey.challenge-expired", err)
		}
		return response.Error(http.StatusBadRequest, "passkey enrollment failed", err)
	}

	usr, err := hs.userService.GetByID(c.Req.Context(), &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to load enrolled user", err)
	}

	resp := util.DynMap{"message": "Signed up", "code": "redirect-to-landing-page"}
	// A self-service signup must finish the same way a password signup does (see SignUpStep2), so run
	// the account-completion steps now that the passkey exists. Invite-initiated enrollment is a
	// separate flow (PW7/PW9) and is not handled here.
	if source == passkey.EnrollSourceSignup {
		if rsp := hs.completePasskeySignup(c.Req.Context(), usr, resp); rsp != nil {
			return rsp
		}
	}

	if err := hs.loginUserWithUser(usr, c); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to login user", err)
	}
	if source == passkey.EnrollSourceSignup {
		metrics.MApiUserSignUpCompleted.Inc()
	}
	return response.JSON(http.StatusOK, resp)
}

// completePasskeySignup runs the post-account-creation steps that the password signup (SignUpStep2)
// performs, so a passwordless signup behaves the same: it announces completion and adds the user to any
// organisation that has a pending invite for their email (switching the response to land them on the
// org picker). It returns a non-nil response only on failure.
//
// One SignUpStep2 step is intentionally omitted: marking the signup TempUser completed. That needs the
// email verification code, which lives only in the begin request and is not carried to finish; a stale
// SignUpStarted TempUser row is harmless.
func (hs *HTTPServer) completePasskeySignup(ctx context.Context, usr *user.User, resp util.DynMap) response.Response {
	if err := hs.bus.Publish(ctx, &events.SignUpCompleted{
		Email: usr.Email,
		Name:  usr.NameOrFallback(),
	}); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to publish event", err)
	}

	invites, err := hs.tempUserService.GetTempUsersQuery(ctx, &tempuser.GetTempUsersQuery{
		Email:  usr.Email,
		Status: tempuser.TmpUserInvitePending,
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to query database for invites", err)
	}
	for _, invite := range invites {
		if ok, rsp := hs.applyUserInvite(ctx, usr, invite, false); !ok {
			return rsp
		}
		resp["code"] = "redirect-to-select-org"
	}
	return nil
}

// reclaimAbandonedPasswordlessUser reuses an existing user row for a repeat passwordless signup, but
// only when that row is provably unusable. CredentialEnrollBegin creates the user before the WebAuthn
// ceremony runs, so a person who dismisses the OS prompt leaves behind a row with no password and no
// passkey: it cannot log in by any means and it squats the email. Reclaiming it lets that person try
// again. We reclaim ONLY when the row has no password, no passkey, and no external-auth (SSO/LDAP)
// link; any of those marks a real account that must never be handed to a different signer, so we
// refuse and the caller reports the email as taken.
//
// Residual edge: on an instance that links SSO accounts by email, an attacker could reclaim an
// abandoned row and enrol a passkey before the real owner's first SSO login links to that same row.
// That is only reachable with open signup and email verification turned off — the configuration the
// docs already advise against.
func (hs *HTTPServer) reclaimAbandonedPasswordlessUser(ctx context.Context, loginOrEmail string) (*user.User, error) {
	usr, err := hs.userService.GetByLoginWithPassword(ctx, &user.GetUserByLoginQuery{LoginOrEmail: loginOrEmail})
	if err != nil {
		return nil, err
	}
	if usr == nil {
		return nil, errors.New("user not found")
	}
	if usr.Password != "" {
		return nil, errors.New("refusing to reclaim: user has a password")
	}

	creds, err := hs.passkeyStore.ListByUser(ctx, usr.ID)
	if err != nil {
		return nil, err
	}
	if len(creds) > 0 {
		return nil, errors.New("refusing to reclaim: user already has a passkey")
	}

	// GetAuthInfo returns user.ErrUserNotFound when the user has no external-auth link. A nil error
	// means a link exists, and any other error is unexpected — both block the reclaim.
	if _, err := hs.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: usr.ID}); err == nil {
		return nil, errors.New("refusing to reclaim: user is linked to an external auth provider")
	} else if !errors.Is(err, user.ErrUserNotFound) {
		return nil, err
	}

	return usr, nil
}

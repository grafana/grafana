package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// passkeyBeginResponse is returned by both login/begin and register/begin. SessionID ties the begin
// and finish halves of one ceremony together; Options is the raw go-webauthn options JSON handed
// straight to navigator.credentials.* in the browser.
type passkeyBeginResponse struct {
	SessionID string          `json:"sessionID"`
	Options   json.RawMessage `json:"options"`
}

// passkeyRegisterFinishRequest is the body posted to finish enrolling a new passkey: the sessionID
// from begin, a user-chosen display name, and the raw attestation the authenticator produced.
type passkeyRegisterFinishRequest struct {
	SessionID string          `json:"sessionID"`
	Name      string          `json:"name"`
	Response  json.RawMessage `json:"response"`
}

// passkeyRenameRequest is the PATCH body for renaming a stored credential.
type passkeyRenameRequest struct {
	Name string `json:"name"`
}

// passkeyCredentialDTO is the safe, user-facing view of a stored credential. Key material
// (PublicKey), the sign counter, and the internal credential-id hash are intentionally omitted.
type passkeyCredentialDTO struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	Created    time.Time  `json:"created"`
	LastUsed   *time.Time `json:"lastUsed,omitempty"`
	Transports string     `json:"transports,omitempty"`
}

// mapPasskeyError translates the passkey domain errors into HTTP responses. response.Err only
// understands errutil.Error and would turn these plain sentinels into a 500, so the status codes are
// set explicitly here. The finish path must stay uniform: every login failure other than an expired
// challenge returns the same 401, so a caller cannot probe whether a given credential exists.
func mapPasskeyError(err error) response.Response {
	switch {
	case errors.Is(err, passkey.ErrChallengeExpired):
		return response.Error(http.StatusGone, "passkey.challenge-expired", err)
	case errors.Is(err, passkey.ErrLoginFailed):
		return response.Error(http.StatusUnauthorized, "passkey login failed", err)
	default:
		return response.Err(err)
	}
}

// checkPasskeyLoginRate returns the caller's IP and, if that IP is currently rate-limited for passkey
// logins, a blocking response to return immediately. The passkey path does not go through the password
// client, so it must throttle brute-force attempts itself (the loginattempt service no-ops when
// brute-force protection is disabled in config).
func (hs *HTTPServer) checkPasskeyLoginRate(c *contextmodel.ReqContext) (string, response.Response) {
	ip := web.RemoteAddr(c.Req)
	ok, err := hs.loginAttemptService.ValidateIPAddress(c.Req.Context(), ip)
	if err != nil {
		return ip, response.Err(err)
	}
	if !ok {
		return ip, response.Error(http.StatusTooManyRequests, "passkey.too-many-attempts", nil)
	}
	return ip, nil
}

// PasskeyLoginBegin starts a usernameless (discoverable) login ceremony and returns the public-key
// request options plus the sessionID the browser echoes back on finish. Anonymous endpoint.
func (hs *HTTPServer) PasskeyLoginBegin(c *contextmodel.ReqContext) response.Response {
	if _, blocked := hs.checkPasskeyLoginRate(c); blocked != nil {
		return blocked
	}

	result, err := hs.passkeyService.BeginLogin(c.Req.Context())
	if err != nil {
		return mapPasskeyError(err)
	}
	return response.JSON(http.StatusOK, passkeyBeginResponse{SessionID: result.SessionID, Options: result.Options})
}

// PasskeyLoginFinish verifies the assertion and logs the user in. It does NOT parse the body: the
// passkey authn client is the sole reader (see clients/passkey.go), so the request is forwarded
// untouched through Login, mirroring LoginPost.
func (hs *HTTPServer) PasskeyLoginFinish(c *contextmodel.ReqContext) response.Response {
	ip, blocked := hs.checkPasskeyLoginRate(c)
	if blocked != nil {
		return blocked
	}

	// Cap the request body up-front so any downstream consumer inherits the limit.
	c.Req.Body = http.MaxBytesReader(c.Resp, c.Req.Body, maxPreAuthFormBodySize)

	identity, err := hs.authnService.Login(c.Req.Context(), authn.ClientPasskey, &authn.Request{HTTPRequest: c.Req})
	if err != nil {
		// Record only genuine verification failures, keyed by IP (login is usernameless). An expired
		// challenge is a timeout, not a guess, so it must not count against a slow user.
		if errors.Is(err, passkey.ErrLoginFailed) {
			if addErr := hs.loginAttemptService.Add(c.Req.Context(), "", ip); addErr != nil {
				hs.log.Warn("failed to record passkey login attempt", "error", addErr)
			}
		}
		return mapPasskeyError(err)
	}

	return authn.HandleLoginResponse(c.Req, c.Resp, hs.Cfg, identity, hs.ValidateRedirectTo, hs.Features)
}

// PasskeyRegisterBegin starts enrolling a new passkey for the already-authenticated user. The user
// identity comes from the session, never the request body.
func (hs *HTTPServer) PasskeyRegisterBegin(c *contextmodel.ReqContext) response.Response {
	userID, errResp := hs.getUserID(c)
	if errResp != nil {
		return errResp
	}

	ru := passkey.RegisteringUser{UserID: userID, Name: c.GetLogin(), DisplayName: c.GetName()}
	result, err := hs.passkeyService.BeginRegistration(c.Req.Context(), ru)
	if err != nil {
		return mapPasskeyError(err)
	}
	return response.JSON(http.StatusOK, passkeyBeginResponse{SessionID: result.SessionID, Options: result.Options})
}

// PasskeyRegisterFinish verifies the attestation and persists the new credential under the given name.
func (hs *HTTPServer) PasskeyRegisterFinish(c *contextmodel.ReqContext) response.Response {
	userID, errResp := hs.getUserID(c)
	if errResp != nil {
		return errResp
	}

	req := passkeyRegisterFinishRequest{}
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	ru := passkey.RegisteringUser{UserID: userID, Name: c.GetLogin(), DisplayName: c.GetName()}
	cred, err := hs.passkeyService.FinishRegistration(c.Req.Context(), req.SessionID, ru, req.Name, req.Response)
	if err != nil {
		return mapPasskeyError(err)
	}
	return response.JSON(http.StatusOK, toPasskeyCredentialDTO(cred))
}

// PasskeyListCredentials returns the calling user's enrolled credentials.
func (hs *HTTPServer) PasskeyListCredentials(c *contextmodel.ReqContext) response.Response {
	userID, errResp := hs.getUserID(c)
	if errResp != nil {
		return errResp
	}

	creds, err := hs.passkeyStore.ListByUser(c.Req.Context(), userID)
	if err != nil {
		return response.Err(err)
	}

	dtos := make([]passkeyCredentialDTO, 0, len(creds))
	for _, cred := range creds {
		dtos = append(dtos, toPasskeyCredentialDTO(cred))
	}
	return response.JSON(http.StatusOK, dtos)
}

// PasskeyRenameCredential renames one of the calling user's credentials. The store call is scoped to
// userID so a user can only rename their own credential.
func (hs *HTTPServer) PasskeyRenameCredential(c *contextmodel.ReqContext) response.Response {
	userID, errResp := hs.getUserID(c)
	if errResp != nil {
		return errResp
	}

	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	req := passkeyRenameRequest{}
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if err := hs.passkeyStore.Rename(c.Req.Context(), id, userID, req.Name); err != nil {
		return response.Err(err)
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "Passkey renamed"})
}

// PasskeyDeleteCredential removes one of the calling user's credentials. The store call is scoped to
// userID so a user can only delete their own credential.
func (hs *HTTPServer) PasskeyDeleteCredential(c *contextmodel.ReqContext) response.Response {
	userID, errResp := hs.getUserID(c)
	if errResp != nil {
		return errResp
	}

	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if err := hs.passkeyStore.Delete(c.Req.Context(), id, userID); err != nil {
		return response.Err(err)
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "Passkey deleted"})
}

func toPasskeyCredentialDTO(cred *passkey.Credential) passkeyCredentialDTO {
	return passkeyCredentialDTO{
		ID:         cred.ID,
		Name:       cred.Name,
		Created:    cred.Created,
		LastUsed:   cred.LastUsed,
		Transports: cred.Transports,
	}
}

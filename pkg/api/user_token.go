package api

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/ua-parser/uap-go/uaparser"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /user/auth-tokens signed_in_user getUserAuthTokens
//
// Auth tokens of the actual User.
//
// Return a list of all auth tokens (devices) that the actual user currently have logged in from.
//
// Responses:
// 200: getUserAuthTokensResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetUserAuthTokens(c *contextmodel.ReqContext) response.Response {
	if !c.IsIdentityType(claims.TypeUser) {
		return response.Error(http.StatusForbidden, "entity not allowed to get tokens", nil)
	}

	userID, err := c.GetInternalID()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to parse user id", err)
	}

	return hs.getUserAuthTokensInternal(c, userID)
}

// swagger:route POST /user/revoke-auth-token signed_in_user revokeUserAuthToken
//
// Revoke an auth token of the actual User.
//
// Revokes the given auth token (device) for the actual user. User of issued auth token (device) will no longer be logged in and will be required to authenticate again upon next activity.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) RevokeUserAuthToken(c *contextmodel.ReqContext) response.Response {
	cmd := auth.RevokeAuthTokenCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if !c.IsIdentityType(claims.TypeUser) {
		return response.Error(http.StatusForbidden, "entity not allowed to revoke tokens", nil)
	}

	userID, err := c.GetInternalID()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to parse user id", err)
	}

	return hs.revokeUserAuthTokenInternal(c, userID, cmd)
}

func (hs *HTTPServer) RotateUserAuthTokenRedirect(c *contextmodel.ReqContext) response.Response {
	if err := hs.rotateToken(c); err != nil {
		hs.log.FromContext(c.Req.Context()).Debug("Failed to rotate token", "error", err)
		if errors.Is(err, auth.ErrInvalidSessionToken) {
			hs.log.FromContext(c.Req.Context()).Debug("Deleting session cookie")
			authn.DeleteSessionCookie(c.Resp, hs.Cfg)
		}
		return response.Redirect(hs.Cfg.AppSubURL + "/login")
	}

	if !c.UseSessionStorageRedirect {
		return response.Redirect(hs.GetRedirectURL(c))
	}

	redirectTo := hs.Cfg.AppSubURL + c.Query("redirectTo")
	if err := hs.ValidateRedirectTo(redirectTo); err != nil {
		return response.Redirect(hs.Cfg.AppSubURL + "/")
	}
	return response.Redirect(redirectTo)
}

// swagger:route POST /user/auth-tokens/rotate
//
// # Rotate the auth token of the caller
//
// Rotate the token of caller, if successful send a new session cookie.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) RotateUserAuthToken(c *contextmodel.ReqContext) response.Response {
	if err := hs.rotateToken(c); err != nil {
		hs.log.FromContext(c.Req.Context()).Debug("Failed to rotate token", "error", err)
		if errors.Is(err, auth.ErrInvalidSessionToken) {
			hs.log.FromContext(c.Req.Context()).Debug("Deleting session cookie")
			authn.DeleteSessionCookie(c.Resp, hs.Cfg)
			return response.ErrOrFallback(http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized), err)
		}

		if errors.Is(err, auth.ErrUserTokenNotFound) {
			return response.ErrOrFallback(http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized), err)
		}

		return response.ErrOrFallback(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), err)
	}

	return response.JSON(http.StatusOK, map[string]any{})
}

func (hs *HTTPServer) rotateToken(c *contextmodel.ReqContext) error {
	token := c.GetCookie(hs.Cfg.LoginCookieName)
	ip, err := network.GetIPFromAddress(c.RemoteAddr())
	if err != nil {
		hs.log.Debug("Failed to get IP from client address", "addr", c.RemoteAddr())
	}

	res, err := hs.AuthTokenService.RotateToken(c.Req.Context(), auth.RotateCommand{
		UnHashedToken: token,
		IP:            ip,
		UserAgent:     c.Req.UserAgent(),
	})
	if err != nil {
		return err
	}

	if res.UnhashedToken != token {
		authn.WriteSessionCookie(c.Resp, hs.Cfg, res)
	}

	return nil
}

func (hs *HTTPServer) logoutUserFromAllDevicesInternal(ctx context.Context, userID int64) response.Response {
	userQuery := user.GetUserByIDQuery{ID: userID}

	_, err := hs.userService.GetByID(ctx, &userQuery)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(http.StatusNotFound, "User not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Could not read user from database", err)
	}

	err = hs.AuthTokenService.RevokeAllUserTokens(ctx, userID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to logout user", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "User logged out",
	})
}

func (hs *HTTPServer) getUserAuthTokensInternal(c *contextmodel.ReqContext, userID int64) response.Response {
	userQuery := user.GetUserByIDQuery{ID: userID}

	_, err := hs.userService.GetByID(c.Req.Context(), &userQuery)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(http.StatusNotFound, "User not found", err)
		} else if errors.Is(err, user.ErrCaseInsensitive) {
			return response.Error(http.StatusConflict,
				"User has conflicting login or email with another user. Please contact server admin", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to get user", err)
	}

	tokens, err := hs.AuthTokenService.GetUserTokens(c.Req.Context(), userID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get user auth tokens", err)
	}

	result := []*dtos.UserToken{}
	for _, token := range tokens {
		isActive := false
		if c.UserToken != nil && c.UserToken.Id == token.Id {
			isActive = true
		}

		parser := uaparser.NewFromSaved()
		client := parser.Parse(token.UserAgent)

		osVersion := ""
		if client.Os.Major != "" {
			osVersion = client.Os.Major

			if client.Os.Minor != "" {
				osVersion = osVersion + "." + client.Os.Minor
			}
		}

		browserVersion := ""
		if client.UserAgent.Major != "" {
			browserVersion = client.UserAgent.Major

			if client.UserAgent.Minor != "" {
				browserVersion = browserVersion + "." + client.UserAgent.Minor
			}
		}

		createdAt := time.Unix(token.CreatedAt, 0)
		seenAt := time.Unix(token.SeenAt, 0)

		if token.SeenAt == 0 {
			seenAt = createdAt
		}

		// Retrieve AuthModule from external session
		authModule := ""
		if externalSession, err := hs.AuthTokenService.GetExternalSession(c.Req.Context(), token.ExternalSessionId); err == nil {
			authModule = login.GetAuthProviderLabel(externalSession.AuthModule)
		}

		result = append(result, &dtos.UserToken{
			Id:                     token.Id,
			IsActive:               isActive,
			ClientIp:               token.ClientIp,
			Device:                 client.Device.ToString(),
			OperatingSystem:        client.Os.Family,
			OperatingSystemVersion: osVersion,
			Browser:                client.UserAgent.Family,
			BrowserVersion:         browserVersion,
			AuthModule:             authModule,
			CreatedAt:              createdAt,
			SeenAt:                 seenAt,
		})
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) revokeUserAuthTokenInternal(c *contextmodel.ReqContext, userID int64, cmd auth.RevokeAuthTokenCmd) response.Response {
	userQuery := user.GetUserByIDQuery{ID: userID}
	_, err := hs.userService.GetByID(c.Req.Context(), &userQuery)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(http.StatusNotFound, "User not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get user", err)
	}

	token, err := hs.AuthTokenService.GetUserToken(c.Req.Context(), userID, cmd.AuthTokenId)
	if err != nil {
		if errors.Is(err, auth.ErrUserTokenNotFound) {
			return response.Error(http.StatusNotFound, "User auth token not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to get user auth token", err)
	}

	if c.UserToken != nil && c.UserToken.Id == token.Id {
		return response.Error(http.StatusBadRequest, "Cannot revoke active user auth token", nil)
	}

	err = hs.AuthTokenService.RevokeToken(c.Req.Context(), token, false)
	if err != nil {
		if errors.Is(err, auth.ErrUserTokenNotFound) {
			return response.Error(http.StatusNotFound, "User auth token not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to revoke user auth token", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "User auth token revoked",
	})
}

// swagger:parameters revokeUserAuthToken
type RevokeUserAuthTokenParams struct {
	// in:body
	// required:true
	Body auth.RevokeAuthTokenCmd `json:"body"`
}

// swagger:response getUserAuthTokensResponse
type GetUserAuthTokensResponse struct {
	// in:body
	Body []*auth.UserToken `json:"body"`
}

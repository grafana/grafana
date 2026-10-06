package authn

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models/usertoken"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
)

// SessionTokenRotator is the token-service operation needed by the HTTP handlers.
type SessionTokenRotator interface {
	RotateToken(context.Context, usertoken.RotateCommand) (*usertoken.UserToken, error)
}

// HandleSessionRotation rotates the session cookie and returns a JSON response.
func HandleSessionRotation(c *contextmodel.ReqContext, cfg *setting.Cfg, tokens SessionTokenRotator) response.Response {
	if err := rotateSessionToken(c, cfg, tokens); err != nil {
		if errors.Is(err, usertoken.ErrInvalidSessionToken) || errors.Is(err, usertoken.ErrUserTokenNotFound) {
			return response.ErrOrFallback(http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized), err)
		}
		return response.ErrOrFallback(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), err)
	}
	return response.JSON(http.StatusOK, map[string]any{})
}

// HandleSessionRotationRedirect rotates the session cookie and returns a local redirect.
func HandleSessionRotationRedirect(c *contextmodel.ReqContext, cfg *setting.Cfg, tokens SessionTokenRotator, validator RedirectValidator) response.Response {
	if err := rotateSessionToken(c, cfg, tokens); err != nil {
		return response.Redirect(cfg.AppSubURL + "/login")
	}

	redirectTo := cfg.AppSubURL + c.Query("redirectTo")
	if !c.UseSessionStorageRedirect {
		redirectTo = c.GetCookie(defaultRedirectToCookieKey)
		if redirectTo != "" {
			cookies.DeleteCookie(c.Resp, defaultRedirectToCookieKey, cookieOptions(cfg))
		}
	}
	if redirectTo != "" {
		if sanitized, err := validator(redirectTo); err == nil {
			return response.Redirect(sanitized)
		}
	}
	return response.Redirect(cfg.AppSubURL + "/")
}

func rotateSessionToken(c *contextmodel.ReqContext, cfg *setting.Cfg, tokens SessionTokenRotator) error {
	token := c.GetCookie(cfg.LoginCookieName)
	ip, err := network.GetIPFromAddress(c.RemoteAddr())
	if err != nil {
		c.Logger.Debug("Failed to get IP from client address", "addr", c.RemoteAddr())
	}

	res, err := tokens.RotateToken(c.Req.Context(), usertoken.RotateCommand{
		UnHashedToken: token,
		IP:            ip,
		UserAgent:     c.Req.UserAgent(),
	})
	if err != nil {
		c.Logger.Debug("Failed to rotate token", "error", err)
		if errors.Is(err, usertoken.ErrInvalidSessionToken) {
			DeleteSessionCookie(c.Resp, cfg)
		}
		return err
	}

	if res.UnhashedToken != token {
		WriteSessionCookie(c.Resp, cfg, res)
	}
	return nil
}

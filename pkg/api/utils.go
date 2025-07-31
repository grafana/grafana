package api

import (
	"context"
	"errors"
	"net/http"
	"net/mail"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"go.opentelemetry.io/otel/trace"
)

func (hs *HTTPServer) GetRedirectURL(c *contextmodel.ReqContext) string {
	cfg := hs.Cfg.Get()
	redirectURL := cfg.AppSubURL + "/"
	if redirectTo := c.GetCookie("redirect_to"); len(redirectTo) > 0 {
		if err := hs.ValidateRedirectTo(redirectTo); err == nil {
			redirectURL = redirectTo
		} else {
			hs.log.FromContext(c.Req.Context()).Debug("Ignored invalid redirect_to cookie value", "redirect_to", redirectTo)
		}
		cookies.DeleteCookie(c.Resp, "redirect_to", hs.CookieOptionsFromCfg)
	}
	return redirectURL
}

func (hs *HTTPServer) errOnExternalUser(ctx context.Context, userID int64) response.Response {
	isExternal, err := hs.isExternalUser(ctx, userID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to validate User", err)
	}
	if isExternal {
		return response.Error(http.StatusForbidden, "Cannot update external User", nil)
	}
	return nil
}

func (hs *HTTPServer) isExternalUser(ctx context.Context, userID int64) (bool, error) {
	info, err := hs.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userID})

	if errors.Is(err, user.ErrUserNotFound) {
		return false, nil
	}

	if err != nil {
		return true, err
	}

	return hs.isProviderEnabled(hs.Cfg, info.AuthModule), nil
}

func ValidateAndNormalizeEmail(email string) (string, error) {
	if email == "" {
		return "", nil
	}

	e, err := mail.ParseAddress(email)
	if err != nil {
		return "", err
	}

	return e.Address, nil
}

func (hs *HTTPServer) injectSpan(c *contextmodel.ReqContext, name string) (*contextmodel.ReqContext, trace.Span) {
	ctx, span := hs.tracer.Start(c.Req.Context(), name)
	c.Req = c.Req.WithContext(ctx)
	return c, span
}

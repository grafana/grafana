package api

import (
	"context"
	"errors"
	"net/mail"

	"github.com/grafana/grafana/pkg/middleware/cookies"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

func (hs *HTTPServer) GetRedirectURL(c *contextmodel.ReqContext) string {
	redirectURL := hs.Cfg.AppSubURL + "/"
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

func (hs *HTTPServer) isExternalUser(ctx context.Context, userID int64) (bool, error) {
	getAuthQuery := login.GetAuthInfoQuery{UserId: userID}
	var err error
	if _, err = hs.authInfoService.GetAuthInfo(ctx, &getAuthQuery); err == nil {
		return true, nil
	}

	if errors.Is(err, user.ErrUserNotFound) {
		return false, nil
	}

	return false, err
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

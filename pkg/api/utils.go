package api

import (
	"net/mail"

	"github.com/grafana/grafana/pkg/middleware/cookies"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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

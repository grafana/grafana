package cookies

import (
	"net/http"
	"net/url"
	"time"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
)

type CookieOptions struct {
	Path             string
	Secure           bool
	SameSiteDisabled bool
	SameSiteMode     http.SameSite
}

func NewCookieOptions() CookieOptions {
	path := "/"
	if len(setting.AppSubUrl) > 0 {
		path = setting.AppSubUrl
	}
	return CookieOptions{
		Path:             path,
		Secure:           setting.CookieSecure,
		SameSiteDisabled: setting.CookieSameSiteDisabled,
		SameSiteMode:     setting.CookieSameSiteMode,
	}
}

type getCookieOptionsFunc func() CookieOptions

func DeleteCookie(w http.ResponseWriter, name string, getCookieOptions getCookieOptionsFunc) {
	WriteCookie(w, name, "", -1, getCookieOptions)
}

func WriteCookie(w http.ResponseWriter, name string, value string, maxAge int, getCookieOptions getCookieOptionsFunc) {
	if getCookieOptions == nil {
		getCookieOptions = NewCookieOptions
	}

	options := getCookieOptions()
	cookie := http.Cookie{
		Name:     name,
		MaxAge:   maxAge,
		Value:    value,
		HttpOnly: true,
		Path:     options.Path,
		Secure:   options.Secure,
	}
	if !options.SameSiteDisabled {
		cookie.SameSite = options.SameSiteMode
	}
	http.SetCookie(w, &cookie)
}

func WriteSessionCookie(ctx *contextmodel.ReqContext, cfg *setting.Cfg, value string, maxLifetime time.Duration) {
	if cfg.Env == setting.Dev {
		ctx.Logger.Info("New token", "unhashed token", value)
	}

	var maxAge int
	if maxLifetime <= 0 {
		maxAge = -1
	} else {
		maxAge = int(maxLifetime.Seconds())
	}

	WriteCookie(ctx.Resp, cfg.LoginCookieName, url.QueryEscape(value), maxAge, nil)
}

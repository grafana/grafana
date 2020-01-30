package middleware

import (
	"net/http"

	"github.com/grafana/grafana/pkg/setting"
)

type CookieOptions struct {
	Path             string
	Secure           bool
	SameSiteDisabled bool
	SameSiteMode     http.SameSite
}

func newCookieOptions() CookieOptions {
	return CookieOptions{
		Path:             setting.AppSubUrl + "/",
		Secure:           setting.CookieSecure,
		SameSiteDisabled: setting.CookieSameSiteDisabled,
		SameSiteMode:     setting.CookieSameSiteMode,
	}
}

type GetCookieOptionsFunc func() CookieOptions

func DeleteCookie(w http.ResponseWriter, name string, getCookieOptionsFunc GetCookieOptionsFunc) {
	WriteCookie(w, name, "", -1, getCookieOptionsFunc)
}

func WriteCookie(w http.ResponseWriter, name string, value string, maxAge int, getCookieOptionsFunc GetCookieOptionsFunc) {
	options := getCookieOptionsFunc()
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

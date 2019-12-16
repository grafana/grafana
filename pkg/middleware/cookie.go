package middleware

import (
	"net/http"

	"github.com/grafana/grafana/pkg/setting"
)

func DeleteCookie(w http.ResponseWriter, name string, cfg *setting.Cfg) {
	WriteCookie(w, name, "", -1, cfg)
}

func WriteCookie(w http.ResponseWriter, name string, value string, maxAge int, cfg *setting.Cfg) {
	cookie := http.Cookie{
		Name:     name,
		MaxAge:   maxAge,
		Value:    value,
		HttpOnly: true,
		Path:     setting.AppSubUrl + "/",
	}
	secure := setting.CookieSecure
	sameSite := setting.CookieSameSite
	if cfg != nil {
		secure = cfg.CookieSecure
		sameSite = cfg.CookieSameSite
	}
	cookie.Secure = secure
	if sameSite != http.SameSiteDefaultMode {
		cookie.SameSite = sameSite
	}
	http.SetCookie(w, &cookie)
}

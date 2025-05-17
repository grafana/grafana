package cookies

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type CookieOptions struct {
	NotHttpOnly      bool
	Path             string
	Domain           string
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
		Domain:           "",
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
	if !featuremgmt.AnyEnabled(&featuremgmt.FeatureManager{}, featuremgmt.FlagPanelExporterCookieDomain) {
		options.Domain = ""
	}
	cookie := http.Cookie{
		Name:     name,
		MaxAge:   maxAge,
		Value:    value,
		Domain:   options.Domain,
		HttpOnly: !options.NotHttpOnly,
		Path:     options.Path,
		Secure:   options.Secure,
	}
	if !options.SameSiteDisabled {
		cookie.SameSite = options.SameSiteMode
	}
	http.SetCookie(w, &cookie)
}

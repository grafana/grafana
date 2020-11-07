package middleware

import "github.com/grafana/grafana/pkg/middleware"

// newCookieOptions returns suitable cookie options.
func (s *MiddlewareService) newCookieOptions() middleware.CookieOptions {
	path := "/"
	if len(s.Cfg.AppSubURL) > 0 {
		path = s.Cfg.AppSubURL
	}
	return middleware.CookieOptions{
		Path:             path,
		Secure:           s.Cfg.CookieSecure,
		SameSiteDisabled: s.Cfg.CookieSameSiteDisabled,
		SameSiteMode:     s.Cfg.CookieSameSiteMode,
	}
}

package middleware

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func CSRF(allowedOrigin, loginCookieName string) func(http.Handler) http.Handler {
	// origin may contain a trailing suffix at the end of the URL
	allowedOrigin = strings.TrimSuffix(allowedOrigin, "/")
	// As per RFC 7231/4.2.2 these methods are idempotent:
	safeMethods := []string{"GET", "HEAD", "OPTIONS", "TRACE"}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// If request has no login cookie - skip CSRF checks
			if _, err := r.Cookie(loginCookieName); err == http.ErrNoCookie {
				next.ServeHTTP(w, r)
				return
			}
			// Skip CSRF checks for "safe" methods
			safe := false
			for _, method := range safeMethods {
				if r.Method == method {
					safe = true
					break
				}
			}
			if safe {
				next.ServeHTTP(w, r)
				return
			}
			// Otherwise - verify that Origin/Referer matches the server origin
			origin := r.Header.Get("Origin")
			if origin == "" {
				// If "Origin" header is empty - try parsing the "Referer" header
				if u, err := url.Parse(r.Referer()); err == nil && u.String() != "" {
					origin = fmt.Sprintf("%s://%s", u.Scheme, u.Host)
				}
			}
			if origin != allowedOrigin {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
		})
	}
}

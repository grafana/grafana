package middleware

import (
	"errors"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

func CSRF(loginCookieName, defaultPort string, logger log.Logger) func(http.Handler) http.Handler {
	// As per RFC 7231/4.2.2 these methods are idempotent:
	// (GET is excluded because it may have side effects in some APIs)
	safeMethods := []string{"HEAD", "OPTIONS", "TRACE"}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// If request has no login cookie - skip CSRF checks
			if _, err := r.Cookie(loginCookieName); errors.Is(err, http.ErrNoCookie) {
				next.ServeHTTP(w, r)
				return
			}
			// Skip CSRF checks for "safe" methods
			for _, method := range safeMethods {
				if r.Method == method {
					next.ServeHTTP(w, r)
					return
				}
			}
			// Otherwise - verify that Origin matches the server origin
			netAddr, err := util.SplitHostPortDefault(r.Host, "", defaultPort)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			origin, err := url.Parse(r.Header.Get("Origin"))
			// Possible TODO: If Origin, but malformed, error?
			// Per url.Parse: The url may be relative (a path, without a host) or absolute (starting with
			// a scheme). Trying to parse a hostname and path without a scheme is invalid but may not
			//  necessarily return an error, due to parsing ambiguities.
			if err != nil {
				logger.Error("error parsing Origin header", "err", err)
			} else if netAddr.Host == "" || (origin.String() != "" && origin.Hostname() != netAddr.Host) {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

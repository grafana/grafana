package middleware

import (
	"errors"
	"net/http"
	"net/url"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

func CSRF(loginCookieName string, logger log.Logger) func(http.Handler) http.Handler {
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
			netAddr, err := util.SplitHostPortDefault(r.Host, "", "0") // we ignore the port
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			origin, err := url.Parse(r.Header.Get("Origin"))
			if err != nil {
				logger.Error("error parsing Origin header", "err", err)
			}

			// X-Forwarded-Host for (reverse) proxy scenarios
			// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host
			xfh, err := url.Parse(r.Header.Get("X-Forwarded-Host"))
			if err != nil {
				logger.Error("error parsing X-Forwarded-Host header", "err", err)
			}

			// X-Forwarded-Host is only used and checked when GF_USE_BEHIND_PROXY is set to 'true'
			if UseBehindProxy := os.Getenv("GF_USE_BEHIND_PROXY"); UseBehindProxy == "true" {

				// Checking that the Host header is not empty AND that the the Origin header matches the Host OR X-Forwarded-Host matches the Origin
				if err != nil || netAddr.Host == "" || ((origin.String() != "" && origin.Hostname() != netAddr.Host) && (xfh.String() != "" && xfh.String() != origin.Hostname())) {
					errormsg := "XFH " + xfh.String() + " != Origin " + origin.Hostname()
					http.Error(w, "origin not allowed - "+errormsg, http.StatusForbidden)
					return
				}

			} else {

				// Checking that the Host header is not empty AND that the the Origin header matches the Host
				if err != nil || netAddr.Host == "" || (origin.String() != "" && origin.Hostname() != netAddr.Host) {
					errormsg := "Origin " + origin.Hostname() + "!= server host " + netAddr.Host
					http.Error(w, "origin not allowed - "+errormsg, http.StatusForbidden)
					return
				}

			}

			next.ServeHTTP(w, r)
		})
	}
}

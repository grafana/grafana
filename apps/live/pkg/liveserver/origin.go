package liveserver

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gobwas/glob"
)

// CheckOriginFunc returns the websocket Origin check: requests without an
// Origin, from the request's own host, from appURL, or matching an allowed
// origin pattern are accepted.
func CheckOriginFunc(appURL *url.URL, originPatterns []string, originGlobs []glob.Glob) func(r *http.Request) bool {
	return func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		if len(originPatterns) == 1 && originPatterns[0] == "*" {
			// fast path for *.
			return true
		}
		originURL, err := url.Parse(strings.ToLower(origin))
		if err != nil {
			logger.Warn("Failed to parse request origin", "error", err, "origin", origin)
			return false
		}
		if strings.EqualFold(originURL.Host, r.Host) {
			return true
		}
		ok, err := checkAllowedOrigin(origin, originURL, appURL, originGlobs)
		if err != nil {
			logger.Warn("Error parsing request origin", "error", err, "origin", origin)
			return false
		}
		if !ok {
			logger.Warn("Request Origin is not authorized", "origin", origin, "host", r.Host, "appUrl", appURL.String(), "allowedOrigins", strings.Join(originPatterns, ","))
			return false
		}
		return true
	}
}

func checkAllowedOrigin(origin string, originURL *url.URL, appURL *url.URL, originGlobs []glob.Glob) (bool, error) {
	// Try to match over configured [server] root_url first.
	if originURL.Port() == "" {
		if strings.EqualFold(originURL.Scheme, appURL.Scheme) && strings.EqualFold(originURL.Host, appURL.Hostname()) {
			return true, nil
		}
	} else {
		if strings.EqualFold(originURL.Scheme, appURL.Scheme) && strings.EqualFold(originURL.Host, appURL.Host) {
			return true, nil
		}
	}
	// If there is still no match try [live] allowed_origins patterns.
	for _, pattern := range originGlobs {
		if pattern.Match(origin) {
			return true, nil
		}
	}
	return false, nil
}

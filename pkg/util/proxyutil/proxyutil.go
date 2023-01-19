package proxyutil

import (
	"net"
	"net/http"
	"sort"

	"github.com/grafana/grafana/pkg/services/user"
)

// UserHeaderName name of the header used when forwarding the Grafana user login.
const UserHeaderName = "X-Grafana-User"

// PrepareProxyRequest prepares a request for being proxied.
// Removes X-Forwarded-Host, X-Forwarded-Port, X-Forwarded-Proto, Origin, Referer headers.
// Set X-Grafana-Referer based on contents of Referer.
// Set X-Forwarded-For headers.
func PrepareProxyRequest(req *http.Request) {
	// Set X-Grafana-Referer to correlate access logs to dashboards
	req.Header.Set("X-Grafana-Referer", req.Header.Get("Referer"))

	// Clear Origin and Referer to avoid CORS issues
	req.Header.Del("Origin")
	req.Header.Del("Referer")

	req.Header.Del("X-Forwarded-Host")
	req.Header.Del("X-Forwarded-Port")
	req.Header.Del("X-Forwarded-Proto")

	if req.RemoteAddr != "" {
		remoteAddr, _, err := net.SplitHostPort(req.RemoteAddr)
		if err != nil {
			remoteAddr = req.RemoteAddr
		}
		if req.Header.Get("X-Forwarded-For") != "" {
			req.Header.Set("X-Forwarded-For", req.Header.Get("X-Forwarded-For")+", "+remoteAddr)
		} else {
			req.Header.Set("X-Forwarded-For", remoteAddr)
		}
	}
}

// ClearCookieHeader clear cookie header, except for cookies specified to be kept (keepCookiesNames) if not in skipCookiesNames.
func ClearCookieHeader(req *http.Request, keepCookiesNames []string, skipCookiesNames []string) {
	keepCookies := map[string]*http.Cookie{}
	for _, c := range req.Cookies() {
		for _, v := range keepCookiesNames {
			if c.Name == v {
				keepCookies[c.Name] = c
			}
		}
	}

	for _, v := range skipCookiesNames {
		delete(keepCookies, v)
	}

	req.Header.Del("Cookie")

	sortedCookies := []string{}
	for name := range keepCookies {
		sortedCookies = append(sortedCookies, name)
	}
	sort.Strings(sortedCookies)

	for _, name := range sortedCookies {
		c := keepCookies[name]
		req.AddCookie(c)
	}
}

// SetProxyResponseHeaders sets proxy response headers.
// Sets Content-Security-Policy: sandbox
func SetProxyResponseHeaders(header http.Header) {
	header.Set("Content-Security-Policy", "sandbox")
}

// ApplyUserHeader Set the X-Grafana-User header if needed (and remove if not).
func ApplyUserHeader(sendUserHeader bool, req *http.Request, user *user.SignedInUser) {
	req.Header.Del(UserHeaderName)
	if sendUserHeader && user != nil && !user.IsAnonymous {
		req.Header.Set(UserHeaderName, user.Login)
	}
}

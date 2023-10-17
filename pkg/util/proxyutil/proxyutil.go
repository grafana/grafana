package proxyutil

import (
	"fmt"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
)

const (
	// UserHeaderName name of the header used when forwarding the Grafana user login.
	UserHeaderName = "X-Grafana-User"
	// IDHeaderName name of the header used when forwarding singed id token of the user
	IDHeaderName = "X-Grafana-Id"
)

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
			// match all
			if v == "[]" {
				keepCookies[c.Name] = c
				continue
			}

			if strings.HasSuffix(v, "[]") {
				// match prefix
				pattern := strings.TrimSuffix(v, "[]")
				if strings.HasPrefix(c.Name, pattern) {
					keepCookies[c.Name] = c
				}
			} else {
				// exact match
				if c.Name == v {
					keepCookies[c.Name] = c
				}
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

// SetViaHeader adds Grafana's reverse proxy to the proxy chain.
// Defined in RFC 9110 7.6.3 https://datatracker.ietf.org/doc/html/rfc9110#name-via
func SetViaHeader(header http.Header, major, minor int) {
	via := fmt.Sprintf("%d.%d grafana", major, minor)
	if old := header.Get("Via"); old != "" {
		via = fmt.Sprintf("%s, %s", via, old)
	}
	header.Set("Via", via)
}

// ApplyUserHeader Set the X-Grafana-User header if needed (and remove if not).
func ApplyUserHeader(sendUserHeader bool, req *http.Request, user identity.Requester) {
	req.Header.Del(UserHeaderName)

	if !sendUserHeader || user == nil || user.IsNil() {
		return
	}

	namespace, _ := user.GetNamespacedID()
	switch namespace {
	case identity.NamespaceUser, identity.NamespaceServiceAccount:
		req.Header.Set(UserHeaderName, user.GetLogin())
	}
}

func ApplyForwardIDHeader(req *http.Request, user identity.Requester) {
	if user == nil || user.IsNil() {
		return
	}

	if token := user.GetIDToken(); token != "" {
		req.Header.Set(IDHeaderName, token)
	}
}

func ApplyTeamHTTPHeaders(req *http.Request, ds *datasources.DataSource, teams []int64) error {
	headers, err := GetTeamHTTPHeaders(ds, teams)
	if err != nil {
		return err
	}

	for header, value := range headers {
		// check if headerv is already set in req.Header
		if req.Header.Get(header) != "" {
			req.Header.Add(header, value)
		} else {
			req.Header.Set(header, value)
		}
	}

	return nil
}

func GetTeamHTTPHeaders(ds *datasources.DataSource, teams []int64) (map[string]string, error) {
	teamHTTPHeadersMap := make(map[string]string)
	teamHTTPHeaders, err := ds.TeamHTTPHeaders()
	if err != nil {
		return nil, err
	}

	for teamID, headers := range teamHTTPHeaders {
		id, err := strconv.ParseInt(teamID, 10, 64)
		if err != nil {
			// FIXME: logging here
			continue
		}

		if !contains(teams, id) {
			continue
		}

		for _, header := range headers {
			// TODO: handle multiple header values
			// add tests for these cases
			teamHTTPHeadersMap[header.Header] = header.Value
		}
	}

	return teamHTTPHeadersMap, nil
}

func contains(slice []int64, value int64) bool {
	for _, v := range slice {
		if v == value {
			return true
		}
	}
	return false
}

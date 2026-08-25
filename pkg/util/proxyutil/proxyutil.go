package proxyutil

import (
	"fmt"
	"net"
	"net/http"
	"net/textproto"
	"sort"
	"strings"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
		if matchesKeepCookiesPattern(c.Name, keepCookiesNames, false) {
			keepCookies[c.Name] = c
		}
	}

	for _, v := range skipCookiesNames {
		delete(keepCookies, v)
	}

	req.Header.Del("Cookie")

	sortedCookies := make([]string, 0, len(keepCookies))
	for name := range keepCookies {
		sortedCookies = append(sortedCookies, name)
	}
	sort.Strings(sortedCookies)

	for _, name := range sortedCookies {
		c := keepCookies[name]
		req.AddCookie(c)
	}
}

// MatchesKeepCookiesPattern reports whether name matches any of the given
// patterns using the keepCookies-style matching semantics: an exact literal
// match, "[]" as a match-all wildcard, or a "prefix[]" prefix match. When
// caseInsensitive is true, exact and prefix comparisons ignore ASCII case,
// which is appropriate for HTTP header names (see RFC 9110 5.1); it should be
// false for cookie names, which are case-sensitive.
func MatchesKeepCookiesPattern(name string, patterns []string, caseInsensitive bool) bool {
	return matchesKeepCookiesPattern(name, patterns, caseInsensitive)
}

func matchesKeepCookiesPattern(name string, patterns []string, caseInsensitive bool) bool {
	cmpName := name
	if caseInsensitive {
		cmpName = strings.ToLower(name)
	}
	for _, p := range patterns {
		if p == "[]" {
			return true
		}
		if strings.HasSuffix(p, "[]") {
			prefix := strings.TrimSuffix(p, "[]")
			if caseInsensitive {
				prefix = strings.ToLower(prefix)
			}
			if strings.HasPrefix(cmpName, prefix) {
				return true
			}
			continue
		}
		cmpP := p
		if caseInsensitive {
			cmpP = strings.ToLower(p)
		}
		if cmpName == cmpP {
			return true
		}
	}
	return false
}

// FilterAllowedHeaders returns the canonical names of headers present in h
// that match the allowList (using keepCookies-style, case-insensitive
// matching) and do not match the denyList. The deny-list takes precedence.
// The returned names are canonicalized via textproto.CanonicalMIMEHeaderKey
// and returned in sorted order so behavior is deterministic. This is used to
// implement the per-datasource `jsonData.allowedHeaders` pass-through, gated
// by the instance-wide deny-list configured in [datasource_forward_headers].
func FilterAllowedHeaders(h http.Header, allowList, denyList []string) []string {
	if len(h) == 0 || len(allowList) == 0 {
		return nil
	}
	seen := map[string]struct{}{}
	for name := range h {
		canon := textproto.CanonicalMIMEHeaderKey(name)
		if _, ok := seen[canon]; ok {
			continue
		}
		if !matchesKeepCookiesPattern(canon, allowList, true) {
			continue
		}
		if matchesKeepCookiesPattern(canon, denyList, true) {
			continue
		}
		seen[canon] = struct{}{}
	}
	if len(seen) == 0 {
		return nil
	}
	names := make([]string, 0, len(seen))
	for n := range seen {
		names = append(names, n)
	}
	sort.Strings(names)
	return names
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

	if user.IsIdentityType(claims.TypeUser) {
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

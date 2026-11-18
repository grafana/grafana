package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// Headers that carry the caller's own credentials to the host that authenticated them.
var callerCredentialHeaders = []string{"Cookie", "Authorization", "X-Access-Token", "X-Grafana-Id"}

// Headers, or header prefixes (ending in "-"), that a trusted proxy uses to
// assert a user's identity: the Kubernetes request-header authenticator's
// defaults and Grafana's auth proxy. The router never asserts identity this
// way, so a caller's values are always dropped.
var identityAssertionHeaders = []string{"X-Remote-User", "X-Remote-Group", "X-Remote-Extra-", "X-Webauth-"}

// Headers, or header prefixes, that change who a request acts as, or for
// which org. Once Grafana has authenticated the caller, the requester's
// tokens alone decide that. Without a requester they pass through: the
// backend authorizes them against the caller's own credentials.
var requesterScopedHeaders = []string{"Impersonate-", "X-Grafana-Org-Id"}

// rewriteOutbound is the ReverseProxy Rewrite shared by every proxy the router
// builds. Authenticated requests forward tokens from the requester, so a
// session cookie or API key never reaches a backend. Internal discovery requests
// without a requester retain their service credentials.
func rewriteOutbound(pr *httputil.ProxyRequest, target *url.URL) {
	pr.SetURL(target)
	pr.SetXForwarded()
	deleteHeaders(pr.Out.Header, identityAssertionHeaders)
	requester, err := identity.GetRequester(pr.In.Context())
	if err != nil {
		return
	}
	deleteHeaders(pr.Out.Header, requesterScopedHeaders)
	for _, name := range callerCredentialHeaders {
		pr.Out.Header.Del(name)
	}
	setRequesterCredentials(pr.Out.Header, requester)
}

// deleteHeaders removes each named header, and every header starting with a
// name that ends in "-".
func deleteHeaders(header http.Header, names []string) {
	for _, name := range names {
		if !strings.HasSuffix(name, "-") {
			header.Del(name)
			continue
		}
		prefix := http.CanonicalHeaderKey(name)
		for key := range header {
			if strings.HasPrefix(http.CanonicalHeaderKey(key), prefix) {
				delete(header, key)
			}
		}
	}
}

// setRequesterCredentials sends the requester's access and ID tokens, which
// backends authenticate.
func setRequesterCredentials(header http.Header, requester identity.Requester) {
	if token := requester.GetAccessToken(); token != "" {
		header.Set("X-Access-Token", "Bearer "+token)
		header.Set("Authorization", "Bearer "+token)
	}
	if token := requester.GetIDToken(); token != "" {
		header.Set("X-Grafana-Id", token)
	}
}

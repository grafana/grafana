package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// Headers that carry the caller's own credentials to the host that authenticated them.
var callerCredentialHeaders = []string{"Cookie", "Authorization", "X-Access-Token", "X-Grafana-Id"}

// rewriteOutbound is the ReverseProxy Rewrite shared by every proxy the router
// builds. When the request carries a requester (the router runs as middleware
// after Grafana authentication), Grafana has already consumed the caller's
// credentials: they are replaced by tokens derived from the requester, so a
// session cookie or API key never reaches a backend. Without a requester
// (the standalone router), the caller's credentials pass through unchanged.
func rewriteOutbound(pr *httputil.ProxyRequest, target *url.URL) {
	pr.SetURL(target)
	pr.SetXForwarded()
	requester, err := identity.GetRequester(pr.In.Context())
	if err != nil {
		return
	}
	for _, name := range callerCredentialHeaders {
		pr.Out.Header.Del(name)
	}
	setRequesterCredentials(pr.Out.Header, requester)
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

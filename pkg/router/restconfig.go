package router

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
)

// serviceTokenExpiry is the lifetime in seconds of a token signed for a service identity.
const serviceTokenExpiry = 300

// NewLoopbackRestConfigProvider lets standalone storage look up folders through
// the router without waiting for an embedded API server to start.
//
// The exchanger signs a token for a service identity. That identity exists only
// in memory, so a remote backend cannot authenticate it without one. A nil
// exchanger sends it as it is.
func NewLoopbackRestConfigProvider(handler http.Handler, exchanger authnlib.TokenExchanger) restcfg.RestConfigProvider {
	return &loopbackRestConfigProvider{handler: handler, exchanger: exchanger}
}

type loopbackRestConfigProvider struct {
	handler   http.Handler
	exchanger authnlib.TokenExchanger
}

func (p *loopbackRestConfigProvider) GetRestConfig(context.Context) (*clientrest.Config, error) {
	// Host is a placeholder - requests forward directly to the provided handler.
	// Folder checks share this client; the default 5 QPS limiter can exhaust write deadlines.
	return &clientrest.Config{Host: "http://router", Transport: p, QPS: -1}, nil
}

func (p *loopbackRestConfigProvider) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := req.Context().Err(); err != nil {
		return nil, err
	}
	requester, err := identity.GetRequester(req.Context())
	if err != nil {
		return nil, err
	}
	req = req.Clone(req.Context())
	signed, err := p.signServiceToken(req, requester)
	if err != nil {
		return nil, err
	}
	if signed != nil {
		// The proxy reads credentials from the requester in the context, not from the headers.
		requester = signed
		req = req.WithContext(identity.WithRequester(req.Context(), requester))
	}
	// Forwarded backends authenticate headers; local handlers also retain the
	// requester through WrapHandler. Read credentials per request, never per client.
	setRequesterCredentials(req.Header, requester)
	return responsewriter.WrapHandler(p.handler)(req)
}

// signServiceToken returns a copy of the requester with a signed token, or nil
// when the requester needs none. It signs for the API group and namespace of
// the request, as the kube-aggregator does. Only a service identity without a
// token of its own gets one, so no user gains service access.
func (p *loopbackRestConfigProvider) signServiceToken(req *http.Request, requester identity.Requester) (identity.Requester, error) {
	static, ok := requester.(*identity.StaticRequester)
	if p.exchanger == nil || !ok || static.AccessToken != "" || !identity.IsServiceIdentityAuth(static) {
		return nil, nil
	}
	group, namespace := requestGroupAndNamespace(req.URL.Path)
	if group == "" {
		return nil, nil
	}
	if namespace == "" {
		namespace = static.GetNamespace()
	}
	// A service identity for one namespace cannot sign a token for another one.
	if static.GetNamespace() != "*" && namespace != static.GetNamespace() {
		return nil, fmt.Errorf("service identity for namespace %q cannot call namespace %q", static.GetNamespace(), namespace)
	}
	expiresIn := serviceTokenExpiry
	res, err := p.exchanger.Exchange(req.Context(), authnlib.TokenExchangeRequest{
		Namespace: namespace,
		Audiences: []string{group},
		ExpiresIn: &expiresIn,
	})
	if err != nil {
		return nil, fmt.Errorf("exchanging token for the service identity: %w", err)
	}
	signed := *static
	signed.AccessToken = res.Token
	return &signed, nil
}

// requestGroupAndNamespace reads the API group and namespace from a path such as
// /apis/<group>/<version>/namespaces/<namespace>/<resource>. Either is empty
// when the path has none.
func requestGroupAndNamespace(path string) (group, namespace string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 3 || parts[0] != "apis" {
		return "", ""
	}
	group = parts[1]
	if len(parts) >= 5 && parts[3] == "namespaces" {
		namespace = parts[4]
	}
	return group, namespace
}

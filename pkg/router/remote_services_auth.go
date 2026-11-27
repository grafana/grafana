package router

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// remoteResourceTokenExpiry is how long, in seconds, a token signed for one
// proxied resource request lives: the aggregator's value.
const remoteResourceTokenExpiry = 300

// remoteServiceSigner signs the requests the router proxies to a remote
// service, in place of the caller's credentials, as the embedded
// kube-aggregator's CAP token middleware did. The MT services authenticate a
// token exchanged for the stack, not a single-tenant Grafana's own tokens:
//
//   - A resource request gets an on-behalf-of token: the requester's ID token
//     exchanged for the group's audience (remoteServiceAudience) and the
//     request's namespace. A service identity, which has no ID token, gets
//     Grafana's own token, and only for the stack's namespace. A cluster-scoped
//     request is signed for the stack's namespace and may only read.
//   - Any other request, the group and OpenAPI discovery a backend serves, gets
//     the stack's discovery token, as the router's own discovery polls do.
//
// The aggregator also had a non-OBO mode (aggregation.cap-token-auth.obo-signing
// disabled), which every wave has since turned off; the router signs OBO only.
type remoteServiceSigner struct {
	exchanger         authnlib.TokenExchanger
	stackNamespace    string
	discoveryAudience string
	next              http.RoundTripper
}

func newRemoteServiceSigner(exchanger authnlib.TokenExchanger, stackNamespace, discoveryAudience string) func(http.RoundTripper) http.RoundTripper {
	return func(next http.RoundTripper) http.RoundTripper {
		return &remoteServiceSigner{exchanger: exchanger, stackNamespace: stackNamespace, discoveryAudience: discoveryAudience, next: next}
	}
}

func (s *remoteServiceSigner) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx := req.Context()
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		// Inside Grafana every proxied request has a requester; without one
		// there is nothing to sign for, and the backend rejects the request.
		return s.next.RoundTrip(req)
	}
	token, err := s.token(ctx, requester)
	if err != nil {
		return nil, err
	}
	out := req.Clone(ctx)
	// The token is the request's only identity: the ID token is in its
	// delegation chain, and the MT auth webhook reads only Authorization.
	out.Header.Del("X-Grafana-Id")
	out.Header.Del(accessTokenHeader)
	out.Header.Set("Authorization", "Bearer "+token)
	return s.next.RoundTrip(out)
}

func (s *remoteServiceSigner) token(ctx context.Context, requester identity.Requester) (string, error) {
	info, ok := request.RequestInfoFrom(ctx)
	if !ok || !info.IsResourceRequest {
		return s.exchange(ctx, authnlib.TokenExchangeRequest{
			Namespace: s.stackNamespace,
			Audiences: []string{s.discoveryAudience},
		})
	}
	namespace := info.Namespace
	if namespace == "" {
		// The MT services authorize cluster-scoped resources for the stack,
		// and only for reading.
		switch info.Verb {
		case "get", "list", "watch":
		default:
			return "", remoteForbidden(info, fmt.Errorf("cluster-scoped %s requests are read-only", info.Verb))
		}
		namespace = s.stackNamespace
	}
	subject := ""
	if identity.IsServiceIdentityAuth(requester) {
		if namespace != s.stackNamespace {
			return "", remoteForbidden(info, fmt.Errorf("a service identity may only use namespace %q", s.stackNamespace))
		}
	} else if subject = requester.GetIDToken(); subject == "" {
		return "", &localProxyError{status: apierrors.NewUnauthorized("the requester has no ID token to sign the request with")}
	}
	expiresIn := remoteResourceTokenExpiry
	return s.exchange(ctx, authnlib.TokenExchangeRequest{
		Namespace:    namespace,
		Audiences:    []string{remoteServiceAudience(info.APIGroup)},
		SubjectToken: subject,
		ExpiresIn:    &expiresIn,
	})
}

func (s *remoteServiceSigner) exchange(ctx context.Context, req authnlib.TokenExchangeRequest) (string, error) {
	rsp, err := s.exchanger.Exchange(ctx, req)
	if err == nil && (rsp == nil || rsp.Token == "") {
		err = fmt.Errorf("empty token")
	}
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		return "", &localProxyError{
			status: apierrors.NewServiceUnavailable(fmt.Sprintf("signing the request for %v: %v", req.Audiences, err)),
			reason: failureAuth,
		}
	}
	return rsp.Token, nil
}

func remoteForbidden(info *request.RequestInfo, err error) error {
	return &localProxyError{status: apierrors.NewForbidden(schema.GroupResource{Group: info.APIGroup, Resource: info.Resource}, info.Name, err)}
}

// remoteServiceAudiences maps a group suffix to the audience of the MT service
// that serves the group. Any other group is its own audience. The aggregator
// matched raw suffixes; matching whole labels keeps a group such as
// pertenantdatasource.grafana.app its own audience.
var remoteServiceAudiences = []struct{ suffix, audience string }{
	{"plugins.grafana.com", "*.plugins.grafana.com"},
	{"datasource.grafana.app", "*.datasource.grafana.app"},
	{"ext.grafana.com", "*.ext.grafana.com"},
	{"ext.grafana.app", "apiextensions.k8s.io"},
}

func remoteServiceAudience(group string) string {
	for _, a := range remoteServiceAudiences {
		if group == a.suffix || strings.HasSuffix(group, "."+a.suffix) {
			return a.audience
		}
	}
	return group
}

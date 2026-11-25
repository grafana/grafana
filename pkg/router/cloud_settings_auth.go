package router

import (
	"context"
	"errors"
	"fmt"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const accessTokenHeader = "X-Access-Token"

// newV2AuthenticationMiddleware authenticates v2 calls to a plugin the way
// v3 calls are (see v3.WithAuthentication): each request carries an access
// token exchanged for the caller, with the plugin ID as its audience, scoped to
// the request's namespace. Missing caller credentials fail the request, except
// for Grafana's own service identity, which uses the service token. A nil
// exchanger leaves requests unauthenticated, as for v3.
func newV2AuthenticationMiddleware(pluginID string, exchanger authnlib.TokenExchanger) backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		if exchanger == nil {
			return next
		}
		return &v2AuthenticationHandler{
			BaseHandler: backend.NewBaseHandler(next),
			pluginID:    pluginID,
			exchanger:   exchanger,
		}
	})
}

type v2AuthenticationHandler struct {
	backend.BaseHandler
	pluginID  string
	exchanger authnlib.TokenExchanger
}

func (h *v2AuthenticationHandler) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req != nil {
		if err := h.authenticate(ctx, req.PluginContext.Namespace, req); err != nil {
			return nil, err
		}
	}
	return h.BaseHandler.CheckHealth(ctx, req)
}

func (h *v2AuthenticationHandler) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req != nil {
		if err := h.authenticate(ctx, req.PluginContext.Namespace, req); err != nil {
			return err
		}
	}
	return h.BaseHandler.CallResource(ctx, req, sender)
}

// audiences returns the API group being requested, from the request info in
// ctx, and the plugin ID when it differs: a plugin accepts tokens for either.
func audiences(ctx context.Context, pluginID string) []string {
	if info, ok := request.RequestInfoFrom(ctx); ok && info.APIGroup != "" && info.APIGroup != pluginID {
		return []string{info.APIGroup, pluginID}
	}
	return []string{pluginID}
}

// authenticate sets the exchanged token on the request's headers, replacing any
// the caller sent.
func (h *v2AuthenticationHandler) authenticate(ctx context.Context, namespace string, req backend.ForwardHTTPHeaders) error {
	caller, ok := authlib.AuthInfoFrom(ctx)
	if !ok || caller == nil {
		return errors.New("plugin token exchange: caller auth info is required")
	}
	// An empty subject token requests Grafana's own service token.
	subjectToken := ""
	if !identity.IsServiceIdentity(ctx) {
		// Prefer the access token to preserve an existing delegation chain.
		subjectToken = caller.GetAccessToken()
		if subjectToken == "" {
			subjectToken = caller.GetIDToken()
		}
		if subjectToken == "" {
			return errors.New("plugin token exchange: caller access or ID token is required")
		}
	}
	if caller.GetNamespace() == "" {
		return errors.New("plugin token exchange: caller namespace is required")
	}
	if namespace == "" {
		namespace = caller.GetNamespace()
	} else if !authlib.NamespaceMatches(caller.GetNamespace(), namespace) {
		return errors.New("plugin token exchange: caller namespace does not cover the requested namespace")
	}
	rsp, err := h.exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{
		Namespace:    namespace,
		Audiences:    audiences(ctx, h.pluginID),
		SubjectToken: subjectToken,
	})
	if err != nil {
		return fmt.Errorf("cloud plugin token exchange: %w", err)
	}
	if rsp == nil || rsp.Token == "" {
		return errors.New("cloud plugin token exchange: empty access token")
	}
	req.SetHTTPHeader(accessTokenHeader, rsp.Token)

	return nil
}

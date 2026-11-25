package router

import (
	"context"
	"errors"
	"fmt"
	"maps"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkconfig "github.com/grafana/grafana-plugin-sdk-go/config"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	accessTokenHeader = "X-Access-Token"
	// pluginAccessTokenKey is the GrafanaConfig key plugins read with
	// GrafanaConfig.PluginAccessToken() for their own outbound calls.
	pluginAccessTokenKey = "GF_PLUGIN_ACCESS_TOKEN"
)

// newV2AuthenticationMiddleware authenticates v2 calls to a plugin the way
// v3 calls are (see v3.WithAuthentication): each request carries an access
// token exchanged for the caller, with the plugin ID as its audience, scoped to
// the request's namespace. The same token is also set in the plugin context's
// GrafanaConfig, where plugins read their access token. Missing caller
// credentials fail the request, except for Grafana's own service identity,
// which uses the service token. A nil exchanger leaves requests
// unauthenticated, as for v3.
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
		if err := h.authenticate(ctx, &req.PluginContext, req); err != nil {
			return nil, err
		}
	}
	return h.BaseHandler.CheckHealth(ctx, req)
}

func (h *v2AuthenticationHandler) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req != nil {
		if err := h.authenticate(ctx, &req.PluginContext, req); err != nil {
			return err
		}
	}
	return h.BaseHandler.CallResource(ctx, req, sender)
}

// authenticate sets the exchanged token on the request's headers, replacing any
// the caller sent, and in the plugin context's config.
func (h *v2AuthenticationHandler) authenticate(ctx context.Context, pCtx *backend.PluginContext, req backend.ForwardHTTPHeaders) error {
	namespace := pCtx.Namespace
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
		Audiences:    []string{h.pluginID},
		SubjectToken: subjectToken,
	})
	if err != nil {
		return fmt.Errorf("plugin token exchange: %w", err)
	}
	if rsp == nil || rsp.Token == "" {
		return errors.New("plugin token exchange: empty access token")
	}
	req.SetHTTPHeader(accessTokenHeader, rsp.Token)

	// GrafanaCfg's map is unexported, so rebuild it with the token added.
	cfg := map[string]string{}
	if pCtx.GrafanaConfig != nil {
		maps.Copy(cfg, pCtx.GrafanaConfig.Config())
	}
	cfg[pluginAccessTokenKey] = rsp.Token
	pCtx.GrafanaConfig = sdkconfig.NewGrafanaCfg(cfg)
	return nil
}

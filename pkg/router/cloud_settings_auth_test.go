package router

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"testing/synctest"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/sony/gobreaker/v2"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type recordingExchanger struct {
	reqs []authnlib.TokenExchangeRequest
	err  error
}

func (e *recordingExchanger) Exchange(_ context.Context, r authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	e.reqs = append(e.reqs, r)
	if e.err != nil {
		return nil, e.err
	}
	return &authnlib.TokenExchangeResponse{Token: "exchanged"}, nil
}

func TestV2AuthenticationMiddleware(t *testing.T) {
	callerCtx := func(access, id string) context.Context {
		return identity.WithRequester(context.Background(), &user.SignedInUser{
			Namespace: "stacks-1", AccessToken: access, IDToken: id,
		})
	}
	var gotHeader string
	next := backend.CheckHealthHandlerFunc(func(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
		gotHeader = req.GetHTTPHeader(accessTokenHeader)
		return &backend.CheckHealthResult{}, nil
	})
	handler := func(ex authnlib.TokenExchanger) backend.CheckHealthHandler {
		h, err := backend.HandlerFromMiddlewares(&backend.Handlers{CheckHealthHandler: next}, newV2AuthenticationMiddleware("my-app", ex))
		require.NoError(t, err)
		return h
	}
	health := func(h backend.CheckHealthHandler, ctx context.Context, ns string) error {
		req := &backend.CheckHealthRequest{PluginContext: backend.PluginContext{Namespace: ns}}
		req.SetHTTPHeader(accessTokenHeader, "caller-supplied")
		_, err := h.CheckHealth(ctx, req)
		return err
	}

	t.Run("exchanges the caller's access token for the plugin audience", func(t *testing.T) {
		ex := &recordingExchanger{}
		require.NoError(t, health(handler(ex), callerCtx("at", "id"), "stacks-1"))
		require.Equal(t, "exchanged", gotHeader)
		require.Equal(t, []authnlib.TokenExchangeRequest{{Namespace: "stacks-1", Audiences: []string{"my-app"}, SubjectToken: "at"}}, ex.reqs)
	})
	t.Run("adds the requested group when it differs from the plugin ID", func(t *testing.T) {
		ex := &recordingExchanger{}
		ctx := request.WithRequestInfo(callerCtx("at", ""), &request.RequestInfo{APIGroup: "my-app.grafana.app"})
		require.NoError(t, health(handler(ex), ctx, "stacks-1"))
		require.Equal(t, []string{"my-app.grafana.app", "my-app"}, ex.reqs[0].Audiences)
	})
	t.Run("does not repeat a group equal to the plugin ID", func(t *testing.T) {
		ex := &recordingExchanger{}
		ctx := request.WithRequestInfo(callerCtx("at", ""), &request.RequestInfo{APIGroup: "my-app"})
		require.NoError(t, health(handler(ex), ctx, "stacks-1"))
		require.Equal(t, []string{"my-app"}, ex.reqs[0].Audiences)
	})
	t.Run("falls back to the ID token", func(t *testing.T) {
		ex := &recordingExchanger{}
		require.NoError(t, health(handler(ex), callerCtx("", "id"), ""))
		require.Equal(t, "id", ex.reqs[0].SubjectToken)
		require.Equal(t, "stacks-1", ex.reqs[0].Namespace)
	})
	t.Run("rejects a namespace the caller does not cover", func(t *testing.T) {
		ex := &recordingExchanger{}
		require.Error(t, health(handler(ex), callerCtx("at", ""), "stacks-2"))
		require.Empty(t, ex.reqs)
	})
	t.Run("rejects a caller without tokens", func(t *testing.T) {
		ex := &recordingExchanger{}
		require.Error(t, health(handler(ex), callerCtx("", ""), "stacks-1"))
		require.Empty(t, ex.reqs)
	})
	t.Run("rejects a missing caller", func(t *testing.T) {
		require.Error(t, health(handler(&recordingExchanger{}), context.Background(), "stacks-1"))
	})
	t.Run("fails the request when the exchange fails", func(t *testing.T) {
		require.Error(t, health(handler(&recordingExchanger{err: errors.New("boom")}), callerCtx("at", ""), "stacks-1"))
	})
	t.Run("nil exchanger leaves the request untouched", func(t *testing.T) {
		gotHeader = ""
		require.NoError(t, health(handler(nil), context.Background(), "stacks-1"))
		require.Equal(t, "caller-supplied", gotHeader)
	})
}

func TestCloudPluginContextFromRequestInfo(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "stacks-1"})
	ctx = request.WithRequestInfo(ctx, &request.RequestInfo{APIVersion: "v0alpha1", Namespace: "stacks-1"})
	_, pCtx, err := cloudPluginContext{}.PluginContextForApp(ctx, "my-app", nil)
	require.NoError(t, err)
	require.Equal(t, "v0alpha1", pCtx.APIVersion)
	require.Equal(t, "stacks-1", pCtx.Namespace)
}

type unavailableHealthClient struct {
	plugins.Client
	calls int
}

func (c *unavailableHealthClient) CheckHealth(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	c.calls++
	return nil, plugins.ErrPluginUnavailable
}

// A token exchange failure says nothing about the plugin, so it must not settle
// the breaker's half-open trial as a success.
func TestV2AuthenticationFailureLeavesHalfOpenBreakerAlone(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		plugin := &unavailableHealthClient{}
		exchanger := &recordingExchanger{}
		b := &PluginBackend{pluginID: "my-app", deps: PluginDependencies{
			Settings:       SettingsDependencies{AuthenticateV2: true},
			TokenExchanger: exchanger,
		}}
		client, err := b.settingsPluginClient(plugin)
		require.NoError(t, err)

		cb := newGroupBreaker("plugin")
		ctx := withClientBreaker(identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "stacks-1", AccessToken: "at"}), cb)
		req := func() error {
			_, err := client.CheckHealth(ctx, &backend.CheckHealthRequest{PluginContext: backend.PluginContext{Namespace: "stacks-1"}})
			return err
		}
		for range breakerOpenAfter {
			require.ErrorIs(t, req(), plugins.ErrPluginUnavailable)
		}
		require.Equal(t, gobreaker.StateOpen, cb.State())

		time.Sleep(breakerOpenFor + time.Second)
		exchanger.err = errors.New("exchange failed")
		calls := plugin.calls
		require.ErrorContains(t, req(), "plugin token exchange")
		require.Equal(t, calls, plugin.calls, "the plugin is not called without a token")
		require.Equal(t, gobreaker.StateHalfOpen, cb.State(), "the failed exchange did not close the breaker")
	})
}

// TestV2AuthenticationWithCoreMiddleware checks the single-tenant composition:
// the plugin client's core middleware runs below v2 authentication, and must
// neither drop the exchanged token nor add the caller's ID token beside it.
func TestV2AuthenticationWithCoreMiddleware(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.JWTAuth.Enabled = true
	cfg.JWTAuth.HeaderName = accessTokenHeader
	var got *backend.CallResourceRequest
	core, err := backend.HandlerFromMiddlewares(&backend.Handlers{
		CallResourceHandler: backend.CallResourceHandlerFunc(func(_ context.Context, req *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			got = req
			return nil
		}),
	}, clientmiddleware.NewClearAuthHeadersMiddleware(&cfg.JWTAuth, &cfg.AuthProxy), clientmiddleware.NewForwardIDMiddleware(nil))
	require.NoError(t, err)
	h, err := backend.HandlerFromMiddlewares(core, newV2AuthenticationMiddleware("my-app", &recordingExchanger{}))
	require.NoError(t, err)

	signedIn := &user.SignedInUser{Namespace: "default", IDToken: "id"}
	httpReq, err := http.NewRequest(http.MethodGet, "/", nil)
	require.NoError(t, err)
	ctx := context.WithValue(identity.WithRequester(context.Background(), signedIn), ctxkey.Key{}, &contextmodel.ReqContext{
		Context: &web.Context{Req: httpReq}, SignedInUser: signedIn,
	})
	req := &backend.CallResourceRequest{PluginContext: backend.PluginContext{Namespace: "default"}}
	req.SetHTTPHeader(accessTokenHeader, "caller-supplied")
	require.NoError(t, h.CallResource(ctx, req, backend.CallResourceResponseSenderFunc(func(*backend.CallResourceResponse) error { return nil })))
	require.Equal(t, "exchanged", got.GetHTTPHeader(accessTokenHeader))
	require.Empty(t, got.GetHTTPHeader("X-Grafana-Id"))
}

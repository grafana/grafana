package router

import (
	"context"
	"errors"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
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
	var gotHeader, gotConfig string
	next := backend.CheckHealthHandlerFunc(func(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
		gotHeader = req.GetHTTPHeader(accessTokenHeader)
		gotConfig = ""
		if req.PluginContext.GrafanaConfig != nil {
			gotConfig = req.PluginContext.GrafanaConfig.Get(pluginAccessTokenKey)
		}
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
		require.Equal(t, "exchanged", gotConfig)
		require.Equal(t, []authnlib.TokenExchangeRequest{{Namespace: "stacks-1", Audiences: []string{"my-app"}, SubjectToken: "at"}}, ex.reqs)
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
		require.Empty(t, gotConfig)
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

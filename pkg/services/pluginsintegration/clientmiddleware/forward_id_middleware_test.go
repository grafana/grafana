package clientmiddleware

import (
	"context"
	"errors"
	"net/http"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// fakeIDTokenDeriver is a stub authnlib.IDTokenDeriver for tests.
type fakeIDTokenDeriver struct {
	calls int
	err   error
}

func (f *fakeIDTokenDeriver) DeriveIDToken(ctx context.Context, subjectToken, namespace string) (*authnlib.DeriveIDTokenResponse, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return &authnlib.DeriveIDTokenResponse{Token: "derived-" + subjectToken}, nil
}

func TestForwardIDMiddleware(t *testing.T) {
	t.Run("When not signed in", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))
		ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context: &web.Context{Req: &http.Request{}},
		})

		t.Run("And requests are for a datasource", func(t *testing.T) {
			pluginContext := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should not set forwarded id header if not present for QueryData", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			})

			t.Run("Should not set forwarded id header if not present for CallResource", func(t *testing.T) {
				err := cdt.MiddlewareHandler.CallResource(ctx, &backend.CallResourceRequest{
					PluginContext: pluginContext,
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.Empty(t, cdt.CallResourceReq.GetHTTPHeaders())
			})

			t.Run("Should not set forwarded id header if not present for CheckHealth", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.CheckHealth(ctx, &backend.CheckHealthRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Empty(t, cdt.CheckHealthReq.GetHTTPHeaders())
			})

			t.Run("Should not set forwarded id header if not present for SubscribeStream", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Empty(t, cdt.SubscribeStreamReq.GetHTTPHeaders())
			})

			t.Run("Should not set forwarded id header if not present for PublishStream", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.PublishStream(ctx, &backend.PublishStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Empty(t, cdt.PublishStreamReq.GetHTTPHeaders())
			})

			t.Run("Should not set forwarded id header if not present for RunStream", func(t *testing.T) {
				err := cdt.MiddlewareHandler.RunStream(ctx, &backend.RunStreamRequest{
					PluginContext: pluginContext,
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.Empty(t, cdt.RunStreamReq.GetHTTPHeaders())
			})
		})
	})

	t.Run("When signed in", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

		ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: &http.Request{}},
			SignedInUser: &user.SignedInUser{IDToken: "some-token"},
		})

		t.Run("And requests are for a datasource", func(t *testing.T) {
			pluginContext := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should set forwarded id header if present for QueryData", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.QueryDataReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header if present for QueryChunkedData", func(t *testing.T) {
				err := cdt.MiddlewareHandler.QueryChunkedData(ctx, &backend.QueryChunkedDataRequest{
					PluginContext: pluginContext,
				}, nopChunkedWriter{})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.QueryChunkedDataReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header if present for CallResource", func(t *testing.T) {
				err := cdt.MiddlewareHandler.CallResource(ctx, &backend.CallResourceRequest{
					PluginContext: pluginContext,
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.CallResourceReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header if present for CheckHealth", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.CheckHealth(ctx, &backend.CheckHealthRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.CheckHealthReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header if present for SubscribeStream", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.SubscribeStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header if present for PublishStream", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.PublishStream(ctx, &backend.PublishStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.PublishStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header if present for RunStream", func(t *testing.T) {
				err := cdt.MiddlewareHandler.RunStream(ctx, &backend.RunStreamRequest{
					PluginContext: pluginContext,
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.RunStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})
		})

		t.Run("And requests are for an app", func(t *testing.T) {
			pluginContext := backend.PluginContext{
				AppInstanceSettings: &backend.AppInstanceSettings{},
			}

			t.Run("Should set forwarded id header to app plugin if present for QueryData", func(t *testing.T) {
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

				ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
					Context:      &web.Context{Req: &http.Request{}},
					SignedInUser: &user.SignedInUser{IDToken: "some-token"},
				})

				_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.QueryDataReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header to app plugin if present for CallResource", func(t *testing.T) {
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

				ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
					Context:      &web.Context{Req: &http.Request{}},
					SignedInUser: &user.SignedInUser{IDToken: "some-token"},
				})

				err := cdt.MiddlewareHandler.CallResource(ctx, &backend.CallResourceRequest{
					PluginContext: pluginContext,
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.CallResourceReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header to app plugin if present for CheckHealth", func(t *testing.T) {
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

				ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
					Context:      &web.Context{Req: &http.Request{}},
					SignedInUser: &user.SignedInUser{IDToken: "some-token"},
				})

				_, err := cdt.MiddlewareHandler.CheckHealth(ctx, &backend.CheckHealthRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.CheckHealthReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header to app plugin if present for SubscribeStream", func(t *testing.T) {
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

				ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
					Context:      &web.Context{Req: &http.Request{}},
					SignedInUser: &user.SignedInUser{IDToken: "some-token"},
				})

				_, err := cdt.MiddlewareHandler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.SubscribeStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header to app plugin if present for PublishStream", func(t *testing.T) {
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

				ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
					Context:      &web.Context{Req: &http.Request{}},
					SignedInUser: &user.SignedInUser{IDToken: "some-token"},
				})

				_, err := cdt.MiddlewareHandler.PublishStream(ctx, &backend.PublishStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.PublishStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header to app plugin if present for RunStream", func(t *testing.T) {
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

				ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
					Context:      &web.Context{Req: &http.Request{}},
					SignedInUser: &user.SignedInUser{IDToken: "some-token"},
				})

				err := cdt.MiddlewareHandler.RunStream(ctx, &backend.RunStreamRequest{
					PluginContext: pluginContext,
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.Equal(t, "some-token", cdt.RunStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})
		})
	})

	t.Run("When signed in with Requester in context", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

		ctx := context.Background()
		requester := &identity.StaticRequester{
			IDToken: "requester-token",
		}
		ctx = identity.WithRequester(ctx, requester)

		t.Run("And requests are for a datasource", func(t *testing.T) {
			pluginContext := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			t.Run("Should set forwarded id header from Requester for QueryData", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "requester-token", cdt.QueryDataReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header from Requester for CallResource", func(t *testing.T) {
				err := cdt.MiddlewareHandler.CallResource(ctx, &backend.CallResourceRequest{
					PluginContext: pluginContext,
				}, nopCallResourceSender)
				require.NoError(t, err)
				require.Equal(t, "requester-token", cdt.CallResourceReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header from Requester for CheckHealth", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.CheckHealth(ctx, &backend.CheckHealthRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "requester-token", cdt.CheckHealthReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header from Requester for SubscribeStream", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "requester-token", cdt.SubscribeStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header from Requester for PublishStream", func(t *testing.T) {
				_, err := cdt.MiddlewareHandler.PublishStream(ctx, &backend.PublishStreamRequest{
					PluginContext: pluginContext,
				})
				require.NoError(t, err)
				require.Equal(t, "requester-token", cdt.PublishStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})

			t.Run("Should set forwarded id header from Requester for RunStream", func(t *testing.T) {
				err := cdt.MiddlewareHandler.RunStream(ctx, &backend.RunStreamRequest{
					PluginContext: pluginContext,
				}, &backend.StreamSender{})
				require.NoError(t, err)
				require.Equal(t, "requester-token", cdt.RunStreamReq.GetHTTPHeader(forwardIDHeaderName))
			})
		})
	})

	t.Run("When signed in with both Requester and SignedInUser", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

		ctx := context.Background()
		requester := &identity.StaticRequester{
			IDToken: "requester-token",
		}
		ctx = identity.WithRequester(ctx, requester)
		ctx = context.WithValue(ctx, ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: &http.Request{}},
			SignedInUser: &user.SignedInUser{IDToken: "signed-in-token"},
		})

		t.Run("Should prefer SignedInUser token over Requester token", func(t *testing.T) {
			pluginContext := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}

			_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
				PluginContext: pluginContext,
			})
			require.NoError(t, err)
			require.Equal(t, "signed-in-token", cdt.QueryDataReq.GetHTTPHeader(forwardIDHeaderName))
		})
	})

	t.Run("When Requester has an access token but no id token", func(t *testing.T) {
		pluginContext := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}

		t.Run("Should derive the id token for a user identity", func(t *testing.T) {
			deriver := &fakeIDTokenDeriver{}
			cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(deriver)))

			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type:        claims.TypeUser,
				AccessToken: "obo-access-token",
				Namespace:   "stacks-1",
			})

			_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
				PluginContext: pluginContext,
			})
			require.NoError(t, err)
			require.Equal(t, "derived-obo-access-token", cdt.QueryDataReq.GetHTTPHeader(forwardIDHeaderName))
			require.Equal(t, 1, deriver.calls)
		})

		t.Run("Should derive the id token for a service account identity", func(t *testing.T) {
			deriver := &fakeIDTokenDeriver{}
			cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(deriver)))

			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type:        claims.TypeServiceAccount,
				AccessToken: "obo-access-token",
				Namespace:   "stacks-1",
			})

			_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
				PluginContext: pluginContext,
			})
			require.NoError(t, err)
			require.Equal(t, "derived-obo-access-token", cdt.QueryDataReq.GetHTTPHeader(forwardIDHeaderName))
			require.Equal(t, 1, deriver.calls)
		})

		t.Run("Should not derive or set the header for a non-user, non-service-account identity", func(t *testing.T) {
			deriver := &fakeIDTokenDeriver{}
			cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(deriver)))

			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type:        claims.TypeAccessPolicy,
				AccessToken: "obo-access-token",
				Namespace:   "stacks-1",
			})

			_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
				PluginContext: pluginContext,
			})
			require.NoError(t, err)
			require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			require.Equal(t, 0, deriver.calls)
		})

		t.Run("Should not set the header if there is no access token to derive from", func(t *testing.T) {
			deriver := &fakeIDTokenDeriver{}
			cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(deriver)))

			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type:      claims.TypeUser,
				Namespace: "stacks-1",
			})

			_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
				PluginContext: pluginContext,
			})
			require.NoError(t, err)
			require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			require.Equal(t, 0, deriver.calls)
		})

		t.Run("Should not set the header, and not fail the request, if deriving fails", func(t *testing.T) {
			deriver := &fakeIDTokenDeriver{err: errors.New("auth-api unreachable")}
			cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(deriver)))

			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type:        claims.TypeUser,
				AccessToken: "obo-access-token",
				Namespace:   "stacks-1",
			})

			_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
				PluginContext: pluginContext,
			})
			require.NoError(t, err)
			require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
			require.Equal(t, 1, deriver.calls)
		})

		t.Run("Should not derive when a nil deriver is configured", func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware(nil)))

			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type:        claims.TypeUser,
				AccessToken: "obo-access-token",
				Namespace:   "stacks-1",
			})

			_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{
				PluginContext: pluginContext,
			})
			require.NoError(t, err)
			require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
		})
	})
}

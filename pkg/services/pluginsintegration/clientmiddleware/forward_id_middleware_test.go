package clientmiddleware

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestForwardIDMiddleware(t *testing.T) {
	t.Run("When not signed in", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))
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
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
				cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewForwardIDMiddleware()))

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
}

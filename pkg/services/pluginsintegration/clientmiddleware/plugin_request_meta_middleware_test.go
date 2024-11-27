package clientmiddleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

func TestPluginRequestMetaMiddleware(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			handlertest.WithMiddlewares(NewPluginRequestMetaMiddleware()),
		)
		_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{})
		require.NoError(t, err)
		ss := pluginrequestmeta.StatusSourceFromContext(cdt.QueryDataCtx)
		require.Equal(t, pluginrequestmeta.StatusSourcePlugin, ss)
	})

	t.Run("other value", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			handlertest.WithMiddlewares(backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
				return &PluginRequestMetaMiddleware{
					BaseHandler:         backend.NewBaseHandler(next),
					defaultStatusSource: "test",
				}
			})),
		)
		_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{})
		require.NoError(t, err)
		ss := pluginrequestmeta.StatusSourceFromContext(cdt.QueryDataCtx)
		require.Equal(t, pluginrequestmeta.StatusSource("test"), ss)
	})
}

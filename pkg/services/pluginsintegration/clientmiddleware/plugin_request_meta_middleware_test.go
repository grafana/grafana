package clientmiddleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

func TestPluginRequestMetaMiddleware(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithMiddlewares(NewPluginRequestMetaMiddleware()),
		)
		_, err := cdt.Decorator.QueryData(context.Background(), &backend.QueryDataRequest{})
		require.NoError(t, err)
		ss := pluginrequestmeta.StatusSourceFromContext(cdt.QueryDataCtx)
		require.Equal(t, pluginrequestmeta.StatusSourcePlugin, ss)
	})

	t.Run("other value", func(t *testing.T) {
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithMiddlewares(plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
				return &PluginRequestMetaMiddleware{
					next:                next,
					defaultStatusSource: "test",
				}
			})),
		)
		_, err := cdt.Decorator.QueryData(context.Background(), &backend.QueryDataRequest{})
		require.NoError(t, err)
		ss := pluginrequestmeta.StatusSourceFromContext(cdt.QueryDataCtx)
		require.Equal(t, pluginrequestmeta.StatusSource("test"), ss)
	})
}

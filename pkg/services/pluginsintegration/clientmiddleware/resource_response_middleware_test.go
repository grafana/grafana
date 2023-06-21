package clientmiddleware

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/stretchr/testify/require"
)

func TestResourceResponseMiddleware(t *testing.T) {
	t.Run("Should set proxy response headers when calling CallResource", func(t *testing.T) {
		crResp := &backend.CallResourceResponse{
			Status: http.StatusOK,
			Headers: map[string][]string{
				"X-Custom": {"Should not be deleted"},
			},
		}
		cdt := clienttest.NewClientDecoratorTest(t,
			clienttest.WithMiddlewares(NewResourceResponseMiddleware()),
			clienttest.WithResourceResponses([]*backend.CallResourceResponse{crResp}),
		)

		var sentResponse *backend.CallResourceResponse
		sender := callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			sentResponse = res
			return nil
		})

		err := cdt.Decorator.CallResource(context.Background(), &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{},
		}, sender)
		require.NoError(t, err)

		require.NotNil(t, sentResponse)
		require.Equal(t, "sandbox", sentResponse.Headers["Content-Security-Policy"][0])
		require.Equal(t, "Should not be deleted", sentResponse.Headers["X-Custom"][0])
	})
}

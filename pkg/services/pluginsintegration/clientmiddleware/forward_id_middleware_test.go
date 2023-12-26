package clientmiddleware

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestForwardIDMiddleware(t *testing.T) {
	settingWithEnabled, err := json.Marshal(map[string]any{
		"forwardGrafanaIdToken": true,
	})
	require.NoError(t, err)

	settingWithDisabled, err := json.Marshal(map[string]any{
		"forwardGrafanaIdToken": false,
	})
	require.NoError(t, err)

	t.Run("Should set forwarded id header if present", func(t *testing.T) {
		cdt := clienttest.NewClientDecoratorTest(t, clienttest.WithMiddlewares(NewForwardIDMiddleware()))

		ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: &http.Request{}},
			SignedInUser: &user.SignedInUser{IDToken: "some-token"},
		})

		err := cdt.Decorator.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					JSONData: settingWithEnabled,
				},
			},
		}, nopCallResourceSender)
		require.NoError(t, err)

		require.Equal(t, "some-token", cdt.CallResourceReq.Headers[forwardIDHeaderName][0])
	})

	t.Run("Should not set forwarded id header if setting is disabled", func(t *testing.T) {
		cdt := clienttest.NewClientDecoratorTest(t, clienttest.WithMiddlewares(NewForwardIDMiddleware()))

		ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: &http.Request{}},
			SignedInUser: &user.SignedInUser{IDToken: "some-token"},
		})

		err := cdt.Decorator.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					JSONData: settingWithDisabled,
				},
			},
		}, nopCallResourceSender)
		require.NoError(t, err)
		require.Len(t, cdt.CallResourceReq.Headers[forwardIDHeaderName], 0)
	})

	t.Run("Should not set forwarded id header if not present", func(t *testing.T) {
		cdt := clienttest.NewClientDecoratorTest(t, clienttest.WithMiddlewares(NewForwardIDMiddleware()))

		ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: &http.Request{}},
			SignedInUser: &user.SignedInUser{},
		})

		err := cdt.Decorator.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					JSONData: settingWithEnabled,
				},
			},
		}, nopCallResourceSender)
		require.NoError(t, err)

		require.Len(t, cdt.CallResourceReq.Headers[forwardIDHeaderName], 0)
	})
}

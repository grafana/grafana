package clientmiddleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func Test_HostedGrafanaACHeaderMiddleware(t *testing.T) {
	t.Run("Should set Grafana request ID headers if the data source URL is in the allow list", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.IPRangeACAllowedURLs = []string{"https://logs.grafana.net"}
		cfg.IPRangeACSecretKey = "secret"
		cdt := clienttest.NewClientDecoratorTest(t, clienttest.WithMiddlewares(NewHostedGrafanaACHeaderMiddleware(cfg)))

		ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: &http.Request{}},
			SignedInUser: &user.SignedInUser{},
		})

		err := cdt.Decorator.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					URL: "https://logs.grafana.net",
				},
			},
		}, nopCallResourceSender)
		require.NoError(t, err)

		require.Len(t, cdt.CallResourceReq.Headers[GrafanaRequestID], 1)
		require.Len(t, cdt.CallResourceReq.Headers[GrafanaSignedRequestID], 1)

		requestID := cdt.CallResourceReq.Headers[GrafanaRequestID][0]

		instance := hmac.New(sha256.New, []byte(cfg.IPRangeACSecretKey))
		_, err = instance.Write([]byte(requestID))
		require.NoError(t, err)
		computed := hex.EncodeToString(instance.Sum(nil))

		require.Equal(t, cdt.CallResourceReq.Headers[GrafanaSignedRequestID][0], computed)
	})

	t.Run("Should not set Grafana request ID headers if the data source URL is not in the allow list", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.IPRangeACAllowedURLs = []string{"https://logs.grafana.net"}
		cfg.IPRangeACSecretKey = "secret"
		cdt := clienttest.NewClientDecoratorTest(t, clienttest.WithMiddlewares(NewHostedGrafanaACHeaderMiddleware(cfg)))

		ctx := context.WithValue(context.Background(), ctxkey.Key{}, &contextmodel.ReqContext{
			Context:      &web.Context{Req: &http.Request{}},
			SignedInUser: &user.SignedInUser{},
		})

		err := cdt.Decorator.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					URL: "https://logs.not-grafana.net",
				},
			},
		}, nopCallResourceSender)
		require.NoError(t, err)

		require.Len(t, cdt.CallResourceReq.Headers[GrafanaRequestID], 0)
		require.Len(t, cdt.CallResourceReq.Headers[GrafanaSignedRequestID], 0)
	})
}

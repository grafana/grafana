package clientmiddleware

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestForwardCookiesMiddleware(t *testing.T) {
	var queryDataReq *backend.QueryDataRequest
	var queryDataCtx context.Context
	var callResourceReq *backend.CallResourceRequest
	var callResourceCtx context.Context
	var checkHealthReq *backend.CheckHealthRequest
	var checkHealthCtx context.Context
	c := &clienttest.TestClient{
		QueryDataFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			queryDataReq = req
			queryDataCtx = ctx
			return nil, nil
		},
		CallResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			callResourceReq = req
			callResourceCtx = ctx
			return nil
		},
		CheckHealthFunc: func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			checkHealthReq = req
			checkHealthCtx = ctx
			return nil, nil
		},
	}
	require.NotNil(t, c)

	req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
	require.NoError(t, err)
	req.AddCookie(&http.Cookie{
		Name: "cookie1",
	})
	req.AddCookie(&http.Cookie{
		Name: "cookie2",
	})
	req.AddCookie(&http.Cookie{
		Name: "cookie3",
	})
	req.AddCookie(&http.Cookie{
		Name: "grafana_session",
	})

	reqContext := &models.ReqContext{
		Context: &web.Context{
			Req: req,
		},
		SignedInUser: &user.SignedInUser{},
	}

	ctx := ctxkey.Set(req.Context(), reqContext)
	*req = *req.WithContext(ctx)

	d, err := client.NewDecorator(c, NewForwardCookiesMiddleware([]string{"grafana_session"}))
	require.NoError(t, err)
	require.NotNil(t, d)

	jsonDataMap := map[string]interface{}{
		"keepCookies": []string{"cookie2", "grafana_session"},
	}
	jsonDataBytes, err := json.Marshal(&jsonDataMap)
	require.NoError(t, err)

	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: jsonDataBytes,
		},
	}

	_, err = d.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.NotNil(t, queryDataReq)
	require.Len(t, queryDataReq.Headers, 1)
	require.EqualValues(t, "cookie2=", queryDataReq.Headers["Cookie"])

	middlewares := httpclient.ContextualMiddlewareFromContext(queryDataCtx)
	require.Len(t, middlewares, 1)
	require.Equal(t, httpclientprovider.ForwardedCookiesMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

	err = d.CallResource(req.Context(), &backend.CallResourceRequest{
		PluginContext: pluginCtx,
		Headers:       map[string][]string{},
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, callResourceReq)
	require.Len(t, callResourceReq.Headers, 1)
	require.Len(t, callResourceReq.Headers["Cookie"], 1)
	require.EqualValues(t, "cookie2=", callResourceReq.Headers["Cookie"][0])

	middlewares = httpclient.ContextualMiddlewareFromContext(callResourceCtx)
	require.Len(t, middlewares, 1)
	require.Equal(t, httpclientprovider.ForwardedCookiesMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())

	_, err = d.CheckHealth(req.Context(), &backend.CheckHealthRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.NotNil(t, checkHealthReq)
	require.Len(t, checkHealthReq.Headers, 1)
	require.EqualValues(t, "cookie2=", checkHealthReq.Headers["Cookie"])

	middlewares = httpclient.ContextualMiddlewareFromContext(checkHealthCtx)
	require.Len(t, middlewares, 1)
	require.Equal(t, httpclientprovider.ForwardedCookiesMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())
}

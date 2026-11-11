package clientmiddleware

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestDataProxyTimeoutMiddleware(t *testing.T) {
	sdkDefaults := sdkhttpclient.TimeoutOptions{
		Timeout:               30 * time.Second,
		DialTimeout:           10 * time.Second,
		KeepAlive:             30 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxConnsPerHost:       0,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
	}

	withTimeout := sdkDefaults
	withTimeout.Timeout = 175 * time.Second

	newPluginCtx := func(pluginID string, jsonData string) backend.PluginContext {
		return backend.PluginContext{
			PluginID:                   pluginID,
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{UID: "ds", JSONData: json.RawMessage(jsonData)},
		}
	}

	queryData := func(t *testing.T, configured sdkhttpclient.TimeoutOptions, pCtx backend.PluginContext) map[string]any {
		t.Helper()
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewDataProxyTimeoutMiddleware(configured, sdkDefaults)))
		_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: pCtx})
		require.NoError(t, err)
		return jsonDataOf(t, cdt.QueryDataReq.PluginContext)
	}

	t.Run("sets the timeouts that differ from the SDK defaults for decoupled core plugins", func(t *testing.T) {
		configured := withTimeout
		configured.DialTimeout = 20 * time.Second
		configured.MaxIdleConns = 50
		configured.MaxIdleConnsPerHost = 50

		jsonData := queryData(t, configured, newPluginCtx("loki", `{"maxLines":1000}`))

		require.Equal(t, map[string]any{
			"maxLines":                float64(1000),
			"timeout":                 float64(175),
			"dialTimeout":             float64(20),
			"httpMaxIdleConns":        float64(50),
			"httpMaxIdleConnsPerHost": float64(50),
		}, jsonData)
	})

	t.Run("keeps the values configured in the datasource", func(t *testing.T) {
		jsonData := queryData(t, withTimeout, newPluginCtx("prometheus", `{"timeout":60}`))
		require.Equal(t, map[string]any{"timeout": float64(60)}, jsonData)
	})

	t.Run("handles empty and null jsonData", func(t *testing.T) {
		for _, raw := range []string{"", "null", "{}"} {
			jsonData := queryData(t, withTimeout, newPluginCtx("tempo", raw))
			require.Equal(t, map[string]any{"timeout": float64(175)}, jsonData, "jsonData %q", raw)
		}
	})

	t.Run("does not change other plugins", func(t *testing.T) {
		jsonData := queryData(t, withTimeout, newPluginCtx("grafana-testdata-datasource", `{}`))
		require.Empty(t, jsonData)
	})

	t.Run("does not change anything when the config matches the SDK defaults", func(t *testing.T) {
		jsonData := queryData(t, sdkDefaults, newPluginCtx("loki", `{}`))
		require.Empty(t, jsonData)
	})

	t.Run("does not modify the original settings", func(t *testing.T) {
		pCtx := newPluginCtx("loki", `{}`)
		original := pCtx.DataSourceInstanceSettings
		jsonData := queryData(t, withTimeout, pCtx)
		require.Equal(t, map[string]any{"timeout": float64(175)}, jsonData)
		require.JSONEq(t, `{}`, string(original.JSONData))
	})

	t.Run("ignores requests without datasource settings", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewDataProxyTimeoutMiddleware(withTimeout, sdkDefaults)))
		_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: backend.PluginContext{PluginID: "loki"}})
		require.NoError(t, err)
		require.Nil(t, cdt.QueryDataReq.PluginContext.DataSourceInstanceSettings)
	})

	t.Run("applies to every datasource request type", func(t *testing.T) {
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewDataProxyTimeoutMiddleware(withTimeout, sdkDefaults)))
		ctx := context.Background()
		expected := map[string]any{"timeout": float64(175)}

		err := cdt.MiddlewareHandler.QueryChunkedData(ctx, &backend.QueryChunkedDataRequest{PluginContext: newPluginCtx("loki", `{}`)}, nopChunkedWriter{})
		require.NoError(t, err)
		require.Equal(t, expected, jsonDataOf(t, cdt.QueryChunkedDataReq.PluginContext))

		err = cdt.MiddlewareHandler.CallResource(ctx, &backend.CallResourceRequest{PluginContext: newPluginCtx("loki", `{}`)}, nopCallResourceSender)
		require.NoError(t, err)
		require.Equal(t, expected, jsonDataOf(t, cdt.CallResourceReq.PluginContext))

		_, err = cdt.MiddlewareHandler.CheckHealth(ctx, &backend.CheckHealthRequest{PluginContext: newPluginCtx("loki", `{}`)})
		require.NoError(t, err)
		require.Equal(t, expected, jsonDataOf(t, cdt.CheckHealthReq.PluginContext))

		_, err = cdt.MiddlewareHandler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{PluginContext: newPluginCtx("loki", `{}`)})
		require.NoError(t, err)
		require.Equal(t, expected, jsonDataOf(t, cdt.SubscribeStreamReq.PluginContext))

		_, err = cdt.MiddlewareHandler.PublishStream(ctx, &backend.PublishStreamRequest{PluginContext: newPluginCtx("loki", `{}`)})
		require.NoError(t, err)
		require.Equal(t, expected, jsonDataOf(t, cdt.PublishStreamReq.PluginContext))

		err = cdt.MiddlewareHandler.RunStream(ctx, &backend.RunStreamRequest{PluginContext: newPluginCtx("loki", `{}`)}, backend.NewStreamSender(nil))
		require.NoError(t, err)
		require.Equal(t, expected, jsonDataOf(t, cdt.RunStreamReq.PluginContext))
	})
}

func TestDataProxyTimeoutSettingsReadBySDK(t *testing.T) {
	sdkDefaults := sdkhttpclient.DefaultTimeoutOptions
	configured := sdkhttpclient.TimeoutOptions{
		Timeout:               175 * time.Second,
		DialTimeout:           11 * time.Second,
		KeepAlive:             31 * time.Second,
		TLSHandshakeTimeout:   12 * time.Second,
		ExpectContinueTimeout: 2 * time.Second,
		MaxConnsPerHost:       5,
		MaxIdleConns:          50,
		MaxIdleConnsPerHost:   50,
		IdleConnTimeout:       91 * time.Second,
	}

	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewDataProxyTimeoutMiddleware(configured, sdkDefaults)))
	_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: backend.PluginContext{
		PluginID:                   "loki",
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
	}})
	require.NoError(t, err)

	opts, err := cdt.QueryDataReq.PluginContext.DataSourceInstanceSettings.HTTPClientOptions(context.Background())
	require.NoError(t, err)
	require.Equal(t, configured, *opts.Timeouts)
}

func jsonDataOf(t *testing.T, pCtx backend.PluginContext) map[string]any {
	t.Helper()
	require.NotNil(t, pCtx.DataSourceInstanceSettings)
	jsonData := map[string]any{}
	if len(pCtx.DataSourceInstanceSettings.JSONData) > 0 {
		require.NoError(t, json.Unmarshal(pCtx.DataSourceInstanceSettings.JSONData, &jsonData))
	}
	return jsonData
}

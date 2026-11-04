package httpclientprovider

import (
	"testing"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

func TestHTTPClientProvider(t *testing.T) {
	t.Run("When creating new provider and SigV4 is disabled should apply expected middleware", func(t *testing.T) {
		origNewProviderFunc := newProviderFunc
		providerOpts := []sdkhttpclient.ProviderOptions{}
		newProviderFunc = func(opts ...sdkhttpclient.ProviderOptions) *sdkhttpclient.Provider {
			providerOpts = opts
			return nil
		}
		t.Cleanup(func() {
			newProviderFunc = origNewProviderFunc
		})
		tracer := tracing.InitializeTracerForTest()
		_ = New(&setting.Cfg{SigV4AuthEnabled: false}, &validations.OSSDataSourceRequestURLValidator{}, tracer)
		require.Len(t, providerOpts, 1)
		o := providerOpts[0]
		require.Len(t, o.Middlewares, 9)
		require.Equal(t, TracingMiddlewareName, o.Middlewares[0].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, DataSourceMetricsMiddlewareName, o.Middlewares[1].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ContextualMiddlewareName, o.Middlewares[2].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, SetUserAgentMiddlewareName, o.Middlewares[3].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.BasicAuthenticationMiddlewareName, o.Middlewares[4].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.CustomHeadersMiddlewareName, o.Middlewares[5].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ResponseLimitMiddlewareName, o.Middlewares[6].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, HostRedirectValidationMiddlewareName, o.Middlewares[7].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ErrorSourceMiddlewareName, o.Middlewares[8].(sdkhttpclient.MiddlewareName).MiddlewareName())
	})

	t.Run("When creating new provider and SigV4 is enabled should apply expected middleware", func(t *testing.T) {
		origNewProviderFunc := newProviderFunc
		providerOpts := []sdkhttpclient.ProviderOptions{}
		newProviderFunc = func(opts ...sdkhttpclient.ProviderOptions) *sdkhttpclient.Provider {
			providerOpts = opts
			return nil
		}
		t.Cleanup(func() {
			newProviderFunc = origNewProviderFunc
		})
		tracer := tracing.InitializeTracerForTest()
		_ = New(&setting.Cfg{SigV4AuthEnabled: true}, &validations.OSSDataSourceRequestURLValidator{}, tracer)
		require.Len(t, providerOpts, 1)
		o := providerOpts[0]
		require.Len(t, o.Middlewares, 10)
		require.Equal(t, TracingMiddlewareName, o.Middlewares[0].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, DataSourceMetricsMiddlewareName, o.Middlewares[1].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ContextualMiddlewareName, o.Middlewares[2].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, SetUserAgentMiddlewareName, o.Middlewares[3].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.BasicAuthenticationMiddlewareName, o.Middlewares[4].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.CustomHeadersMiddlewareName, o.Middlewares[5].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ResponseLimitMiddlewareName, o.Middlewares[6].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, HostRedirectValidationMiddlewareName, o.Middlewares[7].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ErrorSourceMiddlewareName, o.Middlewares[8].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, "sigv4-aws-config", o.Middlewares[9].(sdkhttpclient.MiddlewareName).MiddlewareName())
	})

	t.Run("When creating new provider and http logging is enabled for one plugin, it should apply expected middleware", func(t *testing.T) {
		origNewProviderFunc := newProviderFunc
		providerOpts := []sdkhttpclient.ProviderOptions{}
		newProviderFunc = func(opts ...sdkhttpclient.ProviderOptions) *sdkhttpclient.Provider {
			providerOpts = opts
			return nil
		}
		t.Cleanup(func() {
			newProviderFunc = origNewProviderFunc
		})
		tracer := tracing.InitializeTracerForTest()
		_ = New(&setting.Cfg{PluginSettings: config.PluginSettings{"example": {"har_log_enabled": "true"}}}, &validations.OSSDataSourceRequestURLValidator{}, tracer)
		require.Len(t, providerOpts, 1)
		o := providerOpts[0]
		require.Len(t, o.Middlewares, 10)
		require.Equal(t, TracingMiddlewareName, o.Middlewares[0].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, DataSourceMetricsMiddlewareName, o.Middlewares[1].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ContextualMiddlewareName, o.Middlewares[2].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, SetUserAgentMiddlewareName, o.Middlewares[3].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.BasicAuthenticationMiddlewareName, o.Middlewares[4].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.CustomHeadersMiddlewareName, o.Middlewares[5].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ResponseLimitMiddlewareName, o.Middlewares[6].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, HostRedirectValidationMiddlewareName, o.Middlewares[7].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, HTTPLoggerMiddlewareName, o.Middlewares[8].(sdkhttpclient.MiddlewareName).MiddlewareName())
		require.Equal(t, sdkhttpclient.ErrorSourceMiddlewareName, o.Middlewares[9].(sdkhttpclient.MiddlewareName).MiddlewareName())
	})
}

func TestNewForConfigPreservesProcessTimeouts(t *testing.T) {
	original := sdkhttpclient.DefaultTimeoutOptions
	t.Cleanup(func() { sdkhttpclient.DefaultTimeoutOptions = original })
	cfg := setting.NewCfg()
	cfg.DataProxyTimeout = 30
	tracer := tracing.InitializeTracerForTest()
	processProvider := New(cfg, validations.ProvideURLValidator(), tracer)
	processDefaults := sdkhttpclient.DefaultTimeoutOptions

	for _, timeout := range []int{11, 37} {
		tenantCfg := setting.NewCfg()
		tenantCfg.DataProxyTimeout = timeout
		provider := NewForConfig(tenantCfg, validations.ProvideURLValidator(), tracer)
		client, err := provider.New()
		require.NoError(t, err)
		t.Cleanup(client.CloseIdleConnections)
		require.Equal(t, 30*time.Second, client.Timeout)
		require.Equal(t, processDefaults, sdkhttpclient.DefaultTimeoutOptions)

		client, err = provider.New(sdkhttpclient.Options{Timeouts: &sdkhttpclient.TimeoutOptions{Timeout: 7 * time.Second}})
		require.NoError(t, err)
		t.Cleanup(client.CloseIdleConnections)
		require.Equal(t, 7*time.Second, client.Timeout)
	}
	client, err := processProvider.New()
	require.NoError(t, err)
	t.Cleanup(client.CloseIdleConnections)
	require.Equal(t, 30*time.Second, client.Timeout)
}

func TestSDKDefaultTimeoutOptionsSurvivesOverride(t *testing.T) {
	original := sdkhttpclient.DefaultTimeoutOptions
	t.Cleanup(func() { sdkhttpclient.DefaultTimeoutOptions = original })
	sdkDefaults := SDKDefaultTimeoutOptions()

	cfg := setting.NewCfg()
	cfg.DataProxyTimeout = 175
	New(cfg, validations.ProvideURLValidator(), tracing.InitializeTracerForTest())

	require.Equal(t, 175*time.Second, sdkhttpclient.DefaultTimeoutOptions.Timeout)
	require.Equal(t, sdkDefaults, SDKDefaultTimeoutOptions())
	require.Equal(t, 30*time.Second, SDKDefaultTimeoutOptions().Timeout)
}

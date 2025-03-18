package coreplugin_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/stretchr/testify/require"
)

func TestCorePlugin(t *testing.T) {
	t.Run("New core plugin with empty opts should return expected values", func(t *testing.T) {
		factory := coreplugin.New(backend.ServeOpts{})
		p, err := factory("plugin", log.New("test"), fakes.InitializeNoopTracerForTest(), nil)
		require.NoError(t, err)
		require.NotNil(t, p)
		require.NoError(t, p.Start(context.Background()))
		require.NoError(t, p.Stop(context.Background()))
		require.True(t, p.IsManaged())
		require.False(t, p.Exited())

		_, err = p.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{})
		require.Equal(t, plugins.ErrMethodNotImplemented, err)

		_, err = p.CheckHealth(context.Background(), nil)
		require.Equal(t, plugins.ErrMethodNotImplemented, err)

		err = p.CallResource(context.Background(), nil, nil)
		require.Equal(t, plugins.ErrMethodNotImplemented, err)
	})

	t.Run("New core plugin with handlers set in opts should return expected values", func(t *testing.T) {
		checkHealthCalled := false
		callResourceCalled := false
		factory := coreplugin.New(backend.ServeOpts{
			CheckHealthHandler: backend.CheckHealthHandlerFunc(func(ctx context.Context,
				req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
				checkHealthCalled = true
				return nil, nil
			}),
			CallResourceHandler: backend.CallResourceHandlerFunc(func(ctx context.Context,
				req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				callResourceCalled = true
				return nil
			}),
		})
		p, err := factory("plugin", log.New("test"), fakes.InitializeNoopTracerForTest(), nil)
		require.NoError(t, err)
		require.NotNil(t, p)
		require.NoError(t, p.Start(context.Background()))
		require.NoError(t, p.Stop(context.Background()))
		require.True(t, p.IsManaged())
		require.False(t, p.Exited())

		_, err = p.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{})
		require.Equal(t, plugins.ErrMethodNotImplemented, err)

		_, err = p.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
		require.NoError(t, err)
		require.True(t, checkHealthCalled)

		err = p.CallResource(context.Background(), &backend.CallResourceRequest{}, nil)
		require.NoError(t, err)
		require.True(t, callResourceCalled)
	})
}

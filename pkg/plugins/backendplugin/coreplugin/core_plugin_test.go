package coreplugin_test

import (
	"context"
	"io"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/stretchr/testify/require"
)

func TestCorePlugin(t *testing.T) {
	t.Run("New core plugin with empty opts should return expected values", func(t *testing.T) {
		factory := coreplugin.New(backend.ServeOpts{})
		p, err := factory("plugin", log.New("test"), nil)
		require.NoError(t, err)
		require.NotNil(t, p)
		require.NoError(t, p.Start(context.Background()))
		require.NoError(t, p.Stop(context.Background()))
		require.False(t, p.IsManaged())
		require.False(t, p.Exited())

		_, err = p.CollectMetrics(context.Background())
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)

		_, err = p.CheckHealth(context.Background(), nil)
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)

		_, err = p.CallResource(context.Background(), nil)
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)

		// _, err = p.QueryData(context.Background(), nil)
		// require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
	})

	t.Run("New core plugin with handlers set in opts should return expected values", func(t *testing.T) {
		checkHealthCalled := false
		callResourceCalled := false
		// queryDataCalled := false
		factory := coreplugin.New(backend.ServeOpts{
			CheckHealthHandler: backend.CheckHealthHandlerFunc(func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
				checkHealthCalled = true
				return nil, nil
			}),
			CallResourceHandler: backend.CallResourceHandlerFunc(func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				callResourceCalled = true
				return nil
			}),
			// QueryDataHandler: backend.QueryDataHandlerFunc(func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			// 	queryDataCalled = true
			// 	return nil, nil
			// }),
		})
		p, err := factory("plugin", log.New("test"), nil)
		require.NoError(t, err)
		require.NotNil(t, p)
		require.NoError(t, p.Start(context.Background()))
		require.NoError(t, p.Stop(context.Background()))
		require.False(t, p.IsManaged())
		require.False(t, p.Exited())

		_, err = p.CollectMetrics(context.Background())
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)

		_, err = p.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
		require.NoError(t, err)
		require.True(t, checkHealthCalled)

		stream, err := p.CallResource(context.Background(), &backend.CallResourceRequest{})
		require.NoError(t, err)
		_, err = stream.Recv()
		require.Equal(t, io.EOF, err)
		require.True(t, callResourceCalled)

		// _, err = p.QueryData(context.Background(), nil)
		// require.NoError(t, err)
		// require.True(t, queryDataCalled)
	})
}

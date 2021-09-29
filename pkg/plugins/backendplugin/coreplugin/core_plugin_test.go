package coreplugin_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/util/proxyutil"
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
		require.True(t, p.IsManaged())
		require.False(t, p.Exited())

		_, err = p.CollectMetrics(context.Background())
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)

		_, err = p.CheckHealth(context.Background(), nil)
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)

		err = p.CallResource(context.Background(), nil, nil)
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
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
		p, err := factory("plugin", log.New("test"), nil)
		require.NoError(t, err)
		require.NotNil(t, p)
		require.NoError(t, p.Start(context.Background()))
		require.NoError(t, p.Stop(context.Background()))
		require.True(t, p.IsManaged())
		require.False(t, p.Exited())

		_, err = p.CollectMetrics(context.Background())
		require.Equal(t, backendplugin.ErrMethodNotImplemented, err)

		_, err = p.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
		require.NoError(t, err)
		require.True(t, checkHealthCalled)

		err = p.CallResource(context.Background(), &backend.CallResourceRequest{}, nil)
		require.NoError(t, err)
		require.True(t, callResourceCalled)
	})

	t.Run("Core plugin will pass the signed-in userId in the context", func(t *testing.T) {
		queryDataVerified := false
		callResourceVerified := false
		var expectedUserID string = "test@test.io"
		factory := coreplugin.New(backend.ServeOpts{
			CallResourceHandler: backend.CallResourceHandlerFunc(func(ctx context.Context,
				req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				value := ctx.Value(proxyutil.ContextKeyLoginUser{})
				if value != nil {
					userID := value.(string)
					callResourceVerified = userID == expectedUserID
				}

				return nil
			}),
			QueryDataHandler: backend.QueryDataHandlerFunc(func(ctx context.Context,
				req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				value := ctx.Value(proxyutil.ContextKeyLoginUser{})
				if value != nil {
					userID := value.(string)
					queryDataVerified = userID == expectedUserID
				}
				return &backend.QueryDataResponse{}, nil
			}),
		})
		p, err := factory("plugin", log.New("test"), nil)
		require.NoError(t, err)
		require.NotNil(t, p)
		require.NoError(t, p.Start(context.Background()))
		require.NoError(t, p.Stop(context.Background()))
		require.True(t, p.IsManaged())
		require.False(t, p.Exited())

		_, err = p.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				User: &backend.User{
					Login: expectedUserID,
				}}})
		require.NoError(t, err)
		require.True(t, queryDataVerified)

		err = p.CallResource(context.Background(), &backend.CallResourceRequest{
			PluginContext: backend.PluginContext{
				User: &backend.User{
					Login: expectedUserID,
				}}}, nil)
		require.NoError(t, err)
		require.True(t, callResourceVerified)
	})
}

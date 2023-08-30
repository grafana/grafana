package clientmiddleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/stretchr/testify/require"
)

func TestDownstreamStatusMiddleware(t *testing.T) {
	cdt := clienttest.NewClientDecoratorTest(t,
		clienttest.WithMiddlewares(NewDownstreamStatusMiddleware()),
	)

	t.Run("Should set downstream status when calling QueryData", func(t *testing.T) {
		ctx := context.Background()
		ctx = requestmeta.SetRequestMetaData(ctx, requestmeta.RequestMetaData{
			StatusSource: requestmeta.StatusSourceServer,
		})
		_, err := cdt.Decorator.QueryData(ctx, &backend.QueryDataRequest{})
		require.NoError(t, err)
		rmd := requestmeta.GetRequestMetaData(ctx)
		require.NotNil(t, rmd)
		require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
	})

	t.Run("Should set downstream status when calling CallResource", func(t *testing.T) {
		ctx := context.Background()
		ctx = requestmeta.SetRequestMetaData(ctx, requestmeta.RequestMetaData{
			StatusSource: requestmeta.StatusSourceServer,
		})
		err := cdt.Decorator.CallResource(ctx, &backend.CallResourceRequest{}, nopCallResourceSender)
		require.NoError(t, err)
		rmd := requestmeta.GetRequestMetaData(ctx)
		require.NotNil(t, rmd)
		require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
	})

	t.Run("Should set downstream status when calling CheckHealth", func(t *testing.T) {
		ctx := context.Background()
		ctx = requestmeta.SetRequestMetaData(ctx, requestmeta.RequestMetaData{
			StatusSource: requestmeta.StatusSourceServer,
		})
		_, err := cdt.Decorator.CheckHealth(ctx, &backend.CheckHealthRequest{})
		require.NoError(t, err)
		rmd := requestmeta.GetRequestMetaData(ctx)
		require.NotNil(t, rmd)
		require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
	})

	t.Run("Should set downstream status when calling CollectMetrics", func(t *testing.T) {
		ctx := context.Background()
		ctx = requestmeta.SetRequestMetaData(ctx, requestmeta.RequestMetaData{
			StatusSource: requestmeta.StatusSourceServer,
		})
		_, err := cdt.Decorator.CollectMetrics(ctx, &backend.CollectMetricsRequest{})
		require.NoError(t, err)
		rmd := requestmeta.GetRequestMetaData(ctx)
		require.NotNil(t, rmd)
		require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
	})

	t.Run("Should set downstream status when calling SubscribeStream", func(t *testing.T) {
		ctx := context.Background()
		ctx = requestmeta.SetRequestMetaData(ctx, requestmeta.RequestMetaData{
			StatusSource: requestmeta.StatusSourceServer,
		})
		_, err := cdt.Decorator.SubscribeStream(ctx, &backend.SubscribeStreamRequest{})
		require.NoError(t, err)
		rmd := requestmeta.GetRequestMetaData(ctx)
		require.NotNil(t, rmd)
		require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
	})

	t.Run("Should set downstream status when calling PublishStream", func(t *testing.T) {
		ctx := context.Background()
		ctx = requestmeta.SetRequestMetaData(ctx, requestmeta.RequestMetaData{
			StatusSource: requestmeta.StatusSourceServer,
		})
		_, err := cdt.Decorator.PublishStream(ctx, &backend.PublishStreamRequest{})
		require.NoError(t, err)
		rmd := requestmeta.GetRequestMetaData(ctx)
		require.NotNil(t, rmd)
		require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
	})

	t.Run("Should set downstream status when calling RunStream", func(t *testing.T) {
		ctx := context.Background()
		ctx = requestmeta.SetRequestMetaData(ctx, requestmeta.RequestMetaData{
			StatusSource: requestmeta.StatusSourceServer,
		})
		err := cdt.Decorator.RunStream(ctx, &backend.RunStreamRequest{}, &backend.StreamSender{})
		require.NoError(t, err)
		rmd := requestmeta.GetRequestMetaData(ctx)
		require.NotNil(t, rmd)
		require.Equal(t, requestmeta.StatusSourceDownstream, rmd.StatusSource)
	})
}

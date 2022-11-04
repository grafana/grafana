package client

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/stretchr/testify/require"
)

func TestDecorator(t *testing.T) {
	var queryDataCalled bool
	var callResourceCalled bool
	var checkHealthCalled bool
	c := &clienttest.TestClient{
		QueryDataFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			queryDataCalled = true
			return nil, nil
		},
		CallResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			callResourceCalled = true
			return nil
		},
		CheckHealthFunc: func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			checkHealthCalled = true
			return nil, nil
		},
	}
	require.NotNil(t, c)

	ctx := clienttest.MiddlewareScenarioContext{}

	mwOne := ctx.NewMiddleware("mw1")
	mwTwo := ctx.NewMiddleware("mw2")

	d, err := NewDecorator(c, mwOne, mwTwo)
	require.NoError(t, err)
	require.NotNil(t, d)

	_, _ = d.QueryData(context.Background(), nil)
	require.True(t, queryDataCalled)

	_ = d.CallResource(context.Background(), nil, nil)
	require.True(t, callResourceCalled)

	_, _ = d.CheckHealth(context.Background(), nil)
	require.True(t, checkHealthCalled)

	require.Len(t, ctx.QueryDataCallChain, 4)
	require.EqualValues(t, []string{"before mw1", "before mw2", "after mw2", "after mw1"}, ctx.QueryDataCallChain)
	require.Len(t, ctx.CallResourceCallChain, 4)
	require.EqualValues(t, []string{"before mw1", "before mw2", "after mw2", "after mw1"}, ctx.CallResourceCallChain)
	require.Len(t, ctx.CheckHealthCallChain, 4)
	require.EqualValues(t, []string{"before mw1", "before mw2", "after mw2", "after mw1"}, ctx.CheckHealthCallChain)
}

func TestReverseMiddlewares(t *testing.T) {
	t.Run("Should reverse 1 middleware", func(t *testing.T) {
		ctx := clienttest.MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 1)
		require.Equal(t, "mw1", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})

	t.Run("Should reverse 2 middlewares", func(t *testing.T) {
		ctx := clienttest.MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
			ctx.NewMiddleware("mw2"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 2)
		require.Equal(t, "mw2", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[1].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})

	t.Run("Should reverse 3 middlewares", func(t *testing.T) {
		ctx := clienttest.MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
			ctx.NewMiddleware("mw2"),
			ctx.NewMiddleware("mw3"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 3)
		require.Equal(t, "mw3", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw2", reversed[1].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[2].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})

	t.Run("Should reverse 4 middlewares", func(t *testing.T) {
		ctx := clienttest.MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
			ctx.NewMiddleware("mw2"),
			ctx.NewMiddleware("mw3"),
			ctx.NewMiddleware("mw4"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 4)
		require.Equal(t, "mw4", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw3", reversed[1].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw2", reversed[2].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[3].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})
}

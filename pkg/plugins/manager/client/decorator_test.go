package client

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestReverseMiddlewares(t *testing.T) {
	t.Run("Should reverse 1 middleware", func(t *testing.T) {
		tCtx := testContext{}
		middlewares := []plugins.ClientMiddleware{
			tCtx.createMiddleware("mw1"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 1)
		require.Equal(t, "mw1", reversed[0].CreateClientMiddleware(nil).(*testMiddleware).name)
	})

	t.Run("Should reverse 2 middlewares", func(t *testing.T) {
		tCtx := testContext{}
		middlewares := []plugins.ClientMiddleware{
			tCtx.createMiddleware("mw1"),
			tCtx.createMiddleware("mw2"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 2)
		require.Equal(t, "mw2", reversed[0].CreateClientMiddleware(nil).(*testMiddleware).name)
		require.Equal(t, "mw1", reversed[1].CreateClientMiddleware(nil).(*testMiddleware).name)
	})

	t.Run("Should reverse 3 middlewares", func(t *testing.T) {
		tCtx := testContext{}
		middlewares := []plugins.ClientMiddleware{
			tCtx.createMiddleware("mw1"),
			tCtx.createMiddleware("mw2"),
			tCtx.createMiddleware("mw3"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 3)
		require.Equal(t, "mw3", reversed[0].CreateClientMiddleware(nil).(*testMiddleware).name)
		require.Equal(t, "mw2", reversed[1].CreateClientMiddleware(nil).(*testMiddleware).name)
		require.Equal(t, "mw1", reversed[2].CreateClientMiddleware(nil).(*testMiddleware).name)
	})

	t.Run("Should reverse 4 middlewares", func(t *testing.T) {
		tCtx := testContext{}
		middlewares := []plugins.ClientMiddleware{
			tCtx.createMiddleware("mw1"),
			tCtx.createMiddleware("mw2"),
			tCtx.createMiddleware("mw3"),
			tCtx.createMiddleware("mw4"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 4)
		require.Equal(t, "mw4", reversed[0].CreateClientMiddleware(nil).(*testMiddleware).name)
		require.Equal(t, "mw3", reversed[1].CreateClientMiddleware(nil).(*testMiddleware).name)
		require.Equal(t, "mw2", reversed[2].CreateClientMiddleware(nil).(*testMiddleware).name)
		require.Equal(t, "mw1", reversed[3].CreateClientMiddleware(nil).(*testMiddleware).name)
	})
}

type testContext struct {
}

func (c *testContext) createMiddleware(name string) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &testMiddleware{
			next: next,
			name: name,
		}
	})
}

type testMiddleware struct {
	next                     plugins.Client
	name                     string
	queryDataCallChain       []string
	callResourceCallChain    []string
	collectMetricsCallChain  []string
	checkHealthCallChain     []string
	subscribeStreamCallChain []string
	publishStreamCallChain   []string
	runStreamCallChain       []string
}

func (m *testMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	m.queryDataCallChain = append(m.queryDataCallChain, fmt.Sprintf("before %s", m.name))
	res, err := m.next.QueryData(ctx, req)
	m.queryDataCallChain = append(m.queryDataCallChain, fmt.Sprintf("after %s", m.name))
	return res, err
}

func (m *testMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	m.callResourceCallChain = append(m.callResourceCallChain, fmt.Sprintf("before %s", m.name))
	err := m.next.CallResource(ctx, req, sender)
	m.callResourceCallChain = append(m.callResourceCallChain, fmt.Sprintf("after %s", m.name))
	return err
}

func (m *testMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	m.collectMetricsCallChain = append(m.collectMetricsCallChain, fmt.Sprintf("before %s", m.name))
	res, err := m.next.CollectMetrics(ctx, req)
	m.collectMetricsCallChain = append(m.collectMetricsCallChain, fmt.Sprintf("after %s", m.name))
	return res, err
}

func (m *testMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	m.checkHealthCallChain = append(m.checkHealthCallChain, fmt.Sprintf("before %s", m.name))
	res, err := m.next.CheckHealth(ctx, req)
	m.checkHealthCallChain = append(m.checkHealthCallChain, fmt.Sprintf("after %s", m.name))
	return res, err
}

func (m *testMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	m.subscribeStreamCallChain = append(m.subscribeStreamCallChain, fmt.Sprintf("before %s", m.name))
	res, err := m.next.SubscribeStream(ctx, req)
	m.subscribeStreamCallChain = append(m.subscribeStreamCallChain, fmt.Sprintf("after %s", m.name))
	return res, err
}

func (m *testMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	m.publishStreamCallChain = append(m.publishStreamCallChain, fmt.Sprintf("before %s", m.name))
	res, err := m.next.PublishStream(ctx, req)
	m.publishStreamCallChain = append(m.publishStreamCallChain, fmt.Sprintf("after %s", m.name))
	return res, err
}

func (m *testMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	m.runStreamCallChain = append(m.runStreamCallChain, fmt.Sprintf("before %s", m.name))
	err := m.next.RunStream(ctx, req, sender)
	m.runStreamCallChain = append(m.runStreamCallChain, fmt.Sprintf("after %s", m.name))
	return err
}

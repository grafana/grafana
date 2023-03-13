package client

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestDecorator(t *testing.T) {
	var queryDataCalled bool
	var callResourceCalled bool
	var checkHealthCalled bool
	c := &TestClient{
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

	ctx := MiddlewareScenarioContext{}

	mwOne := ctx.NewMiddleware("mw1")
	mwTwo := ctx.NewMiddleware("mw2")

	d, err := NewDecorator(c, mwOne, mwTwo)
	require.NoError(t, err)
	require.NotNil(t, d)

	_, _ = d.QueryData(context.Background(), &backend.QueryDataRequest{})
	require.True(t, queryDataCalled)

	sender := callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		return nil
	})

	_ = d.CallResource(context.Background(), &backend.CallResourceRequest{}, sender)
	require.True(t, callResourceCalled)

	_, _ = d.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
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
		ctx := MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 1)
		require.Equal(t, "mw1", reversed[0].CreateClientMiddleware(nil).(*TestMiddleware).Name)
	})

	t.Run("Should reverse 2 middlewares", func(t *testing.T) {
		ctx := MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
			ctx.NewMiddleware("mw2"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 2)
		require.Equal(t, "mw2", reversed[0].CreateClientMiddleware(nil).(*TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[1].CreateClientMiddleware(nil).(*TestMiddleware).Name)
	})

	t.Run("Should reverse 3 middlewares", func(t *testing.T) {
		ctx := MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
			ctx.NewMiddleware("mw2"),
			ctx.NewMiddleware("mw3"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 3)
		require.Equal(t, "mw3", reversed[0].CreateClientMiddleware(nil).(*TestMiddleware).Name)
		require.Equal(t, "mw2", reversed[1].CreateClientMiddleware(nil).(*TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[2].CreateClientMiddleware(nil).(*TestMiddleware).Name)
	})

	t.Run("Should reverse 4 middlewares", func(t *testing.T) {
		ctx := MiddlewareScenarioContext{}
		middlewares := []plugins.ClientMiddleware{
			ctx.NewMiddleware("mw1"),
			ctx.NewMiddleware("mw2"),
			ctx.NewMiddleware("mw3"),
			ctx.NewMiddleware("mw4"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 4)
		require.Equal(t, "mw4", reversed[0].CreateClientMiddleware(nil).(*TestMiddleware).Name)
		require.Equal(t, "mw3", reversed[1].CreateClientMiddleware(nil).(*TestMiddleware).Name)
		require.Equal(t, "mw2", reversed[2].CreateClientMiddleware(nil).(*TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[3].CreateClientMiddleware(nil).(*TestMiddleware).Name)
	})
}

type TestClient struct {
	plugins.Client
	QueryDataFunc    backend.QueryDataHandlerFunc
	CallResourceFunc backend.CallResourceHandlerFunc
	CheckHealthFunc  backend.CheckHealthHandlerFunc
}

func (c *TestClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if c.QueryDataFunc != nil {
		return c.QueryDataFunc(ctx, req)
	}

	return nil, nil
}

func (c *TestClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.CallResourceFunc != nil {
		return c.CallResourceFunc(ctx, req, sender)
	}

	return nil
}

func (c *TestClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if c.CheckHealthFunc != nil {
		return c.CheckHealthFunc(ctx, req)
	}

	return nil, nil
}

type MiddlewareScenarioContext struct {
	QueryDataCallChain       []string
	CallResourceCallChain    []string
	CollectMetricsCallChain  []string
	CheckHealthCallChain     []string
	SubscribeStreamCallChain []string
	PublishStreamCallChain   []string
	RunStreamCallChain       []string
}

func (ctx *MiddlewareScenarioContext) NewMiddleware(name string) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &TestMiddleware{
			next: next,
			Name: name,
			sCtx: ctx,
		}
	})
}

type TestMiddleware struct {
	next plugins.Client
	sCtx *MiddlewareScenarioContext
	Name string
}

func (m *TestMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	m.sCtx.QueryDataCallChain = append(m.sCtx.QueryDataCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.QueryData(ctx, req)
	m.sCtx.QueryDataCallChain = append(m.sCtx.QueryDataCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	m.sCtx.CallResourceCallChain = append(m.sCtx.CallResourceCallChain, fmt.Sprintf("before %s", m.Name))
	err := m.next.CallResource(ctx, req, sender)
	m.sCtx.CallResourceCallChain = append(m.sCtx.CallResourceCallChain, fmt.Sprintf("after %s", m.Name))
	return err
}

func (m *TestMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	m.sCtx.CollectMetricsCallChain = append(m.sCtx.CollectMetricsCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.CollectMetrics(ctx, req)
	m.sCtx.CollectMetricsCallChain = append(m.sCtx.CollectMetricsCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	m.sCtx.CheckHealthCallChain = append(m.sCtx.CheckHealthCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.CheckHealth(ctx, req)
	m.sCtx.CheckHealthCallChain = append(m.sCtx.CheckHealthCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	m.sCtx.SubscribeStreamCallChain = append(m.sCtx.SubscribeStreamCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.SubscribeStream(ctx, req)
	m.sCtx.SubscribeStreamCallChain = append(m.sCtx.SubscribeStreamCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	m.sCtx.PublishStreamCallChain = append(m.sCtx.PublishStreamCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.PublishStream(ctx, req)
	m.sCtx.PublishStreamCallChain = append(m.sCtx.PublishStreamCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	m.sCtx.RunStreamCallChain = append(m.sCtx.RunStreamCallChain, fmt.Sprintf("before %s", m.Name))
	err := m.next.RunStream(ctx, req, sender)
	m.sCtx.RunStreamCallChain = append(m.sCtx.RunStreamCallChain, fmt.Sprintf("after %s", m.Name))
	return err
}

var _ plugins.Client = &TestClient{}

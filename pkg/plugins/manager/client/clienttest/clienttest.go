package clienttest

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
)

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

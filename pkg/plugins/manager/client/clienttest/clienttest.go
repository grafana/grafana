package clienttest

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
)

type TestClient struct {
	plugins.Client
	queryDataFunc    backend.QueryDataHandlerFunc
	callResourceFunc backend.CallResourceHandlerFunc
	checkHealthFunc  backend.CheckHealthHandlerFunc
}

func NewClient() *TestClient {
	return &TestClient{}
}

func (c *TestClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if c.queryDataFunc != nil {
		return c.queryDataFunc(ctx, req)
	}

	return nil, nil
}

func (c *TestClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.callResourceFunc != nil {
		return c.callResourceFunc(ctx, req, sender)
	}

	return nil
}

func (c *TestClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if c.checkHealthFunc != nil {
		return c.checkHealthFunc(ctx, req)
	}

	return nil, nil
}

type TestMiddleware struct {
	next                     plugins.Client
	Name                     string
	queryDataCallChain       []string
	callResourceCallChain    []string
	collectMetricsCallChain  []string
	checkHealthCallChain     []string
	subscribeStreamCallChain []string
	publishStreamCallChain   []string
	runStreamCallChain       []string
}

func NewMiddleware(name string) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &TestMiddleware{
			next: next,
			Name: name,
		}
	})
}

func (m *TestMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	m.queryDataCallChain = append(m.queryDataCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.QueryData(ctx, req)
	m.queryDataCallChain = append(m.queryDataCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	m.callResourceCallChain = append(m.callResourceCallChain, fmt.Sprintf("before %s", m.Name))
	err := m.next.CallResource(ctx, req, sender)
	m.callResourceCallChain = append(m.callResourceCallChain, fmt.Sprintf("after %s", m.Name))
	return err
}

func (m *TestMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	m.collectMetricsCallChain = append(m.collectMetricsCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.CollectMetrics(ctx, req)
	m.collectMetricsCallChain = append(m.collectMetricsCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	m.checkHealthCallChain = append(m.checkHealthCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.CheckHealth(ctx, req)
	m.checkHealthCallChain = append(m.checkHealthCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	m.subscribeStreamCallChain = append(m.subscribeStreamCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.SubscribeStream(ctx, req)
	m.subscribeStreamCallChain = append(m.subscribeStreamCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	m.publishStreamCallChain = append(m.publishStreamCallChain, fmt.Sprintf("before %s", m.Name))
	res, err := m.next.PublishStream(ctx, req)
	m.publishStreamCallChain = append(m.publishStreamCallChain, fmt.Sprintf("after %s", m.Name))
	return res, err
}

func (m *TestMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	m.runStreamCallChain = append(m.runStreamCallChain, fmt.Sprintf("before %s", m.Name))
	err := m.next.RunStream(ctx, req, sender)
	m.runStreamCallChain = append(m.runStreamCallChain, fmt.Sprintf("after %s", m.Name))
	return err
}

var _ plugins.Client = &TestClient{}
var _ plugins.ClientMiddleware = NewMiddleware("")

package clienttest

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

type TestClient struct {
	plugins.Client
	QueryDataFunc       backend.QueryDataHandlerFunc
	CallResourceFunc    backend.CallResourceHandlerFunc
	CheckHealthFunc     backend.CheckHealthHandlerFunc
	CollectMetricsFunc  backend.CollectMetricsHandlerFunc
	SubscribeStreamFunc func(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error)
	PublishStreamFunc   func(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error)
	RunStreamFunc       func(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error
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

func (c *TestClient) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if c.CollectMetricsFunc != nil {
		return c.CollectMetricsFunc(ctx, req)
	}

	return nil, nil
}

func (c *TestClient) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if c.PublishStreamFunc != nil {
		return c.PublishStreamFunc(ctx, req)
	}

	return nil, nil
}

func (c *TestClient) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if c.SubscribeStreamFunc != nil {
		return c.SubscribeStreamFunc(ctx, req)
	}

	return nil, nil
}

func (c *TestClient) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if c.RunStreamFunc != nil {
		return c.RunStreamFunc(ctx, req, sender)
	}
	return nil
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

type ClientDecoratorTest struct {
	T                  *testing.T
	Context            context.Context
	TestClient         *TestClient
	Middlewares        []plugins.ClientMiddleware
	Decorator          *client.Decorator
	ReqContext         *contextmodel.ReqContext
	QueryDataReq       *backend.QueryDataRequest
	QueryDataCtx       context.Context
	CallResourceReq    *backend.CallResourceRequest
	CallResourceCtx    context.Context
	CheckHealthReq     *backend.CheckHealthRequest
	CheckHealthCtx     context.Context
	CollectMetricsReq  *backend.CollectMetricsRequest
	CollectMetricsCtx  context.Context
	SubscribeStreamReq *backend.SubscribeStreamRequest
	SubscribeStreamCtx context.Context
	PublishStreamReq   *backend.PublishStreamRequest
	PublishStreamCtx   context.Context

	// When CallResource is called, the sender will be called with these values
	callResourceResponses []*backend.CallResourceResponse
}

type ClientDecoratorTestOption func(*ClientDecoratorTest)

func NewClientDecoratorTest(t *testing.T, opts ...ClientDecoratorTestOption) *ClientDecoratorTest {
	cdt := &ClientDecoratorTest{
		T:       t,
		Context: context.Background(),
	}
	cdt.TestClient = &TestClient{
		QueryDataFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			cdt.QueryDataReq = req
			cdt.QueryDataCtx = ctx
			return nil, nil
		},
		CallResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			cdt.CallResourceReq = req
			cdt.CallResourceCtx = ctx
			if cdt.callResourceResponses != nil {
				for _, r := range cdt.callResourceResponses {
					if err := sender.Send(r); err != nil {
						return err
					}
				}
			}
			return nil
		},
		CheckHealthFunc: func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
			cdt.CheckHealthReq = req
			cdt.CheckHealthCtx = ctx
			return nil, nil
		},
		CollectMetricsFunc: func(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
			cdt.CollectMetricsReq = req
			cdt.CollectMetricsCtx = ctx
			return nil, nil
		},
		SubscribeStreamFunc: func(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
			cdt.SubscribeStreamReq = req
			cdt.SubscribeStreamCtx = ctx
			return nil, nil
		},
		PublishStreamFunc: func(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
			cdt.PublishStreamReq = req
			cdt.PublishStreamCtx = ctx
			return nil, nil
		},
	}
	require.NotNil(t, cdt)

	for _, opt := range opts {
		opt(cdt)
	}

	d, err := client.NewDecorator(cdt.TestClient, cdt.Middlewares...)
	require.NoError(t, err)
	require.NotNil(t, d)

	cdt.Decorator = d

	return cdt
}

func WithReqContext(req *http.Request, user *user.SignedInUser) ClientDecoratorTestOption {
	return ClientDecoratorTestOption(func(cdt *ClientDecoratorTest) {
		if cdt.ReqContext == nil {
			cdt.ReqContext = &contextmodel.ReqContext{
				Context: &web.Context{
					Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder()),
				},
				SignedInUser: user,
			}
		}

		cdt.Context = ctxkey.Set(cdt.Context, cdt.ReqContext)

		*req = *req.WithContext(cdt.Context)
		cdt.ReqContext.Req = req
	})
}

func WithMiddlewares(middlewares ...plugins.ClientMiddleware) ClientDecoratorTestOption {
	return ClientDecoratorTestOption(func(cdt *ClientDecoratorTest) {
		if cdt.Middlewares == nil {
			cdt.Middlewares = []plugins.ClientMiddleware{}
		}

		cdt.Middlewares = append(cdt.Middlewares, middlewares...)
	})
}

// WithResourceResponses can be used to make the test client send simulated resource responses back over the sender stream
func WithResourceResponses(responses []*backend.CallResourceResponse) ClientDecoratorTestOption {
	return ClientDecoratorTestOption(func(cdt *ClientDecoratorTest) {
		cdt.callResourceResponses = responses
	})
}

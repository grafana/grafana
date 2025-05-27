package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

const forwardIDHeaderName = "X-Grafana-Id"

// NewForwardIDMiddleware creates a new backend.HandlerMiddleware that will
// set grafana id header on outgoing backend.Handler requests
func NewForwardIDMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &ForwardIDMiddleware{
			log:         log.New("forward_id_middleware"),
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type ForwardIDMiddleware struct {
	log log.Logger

	backend.BaseHandler
}

func (m *ForwardIDMiddleware) applyToken(ctx context.Context, _ backend.PluginContext, req backend.ForwardHTTPHeaders) error {
	if req == nil {
		return nil
	}

	reqCtx := contexthandler.FromContext(ctx)
	// no HTTP request context => check requester
	if reqCtx == nil || reqCtx.SignedInUser == nil {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			m.log.Debug("Failed to get requester from context", "error", err)
			return nil
		}

		if requester.GetIDToken() != "" {
			req.SetHTTPHeader(forwardIDHeaderName, requester.GetIDToken())
			return nil
		}
		return nil
	}

	if token := reqCtx.GetIDToken(); token != "" {
		req.SetHTTPHeader(forwardIDHeaderName, token)
	}

	return nil
}

func (m *ForwardIDMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *ForwardIDMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *ForwardIDMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *ForwardIDMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.SubscribeStream(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *ForwardIDMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.PublishStream(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *ForwardIDMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req == nil {
		return m.BaseHandler.RunStream(ctx, req, sender)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.BaseHandler.RunStream(ctx, req, sender)
}

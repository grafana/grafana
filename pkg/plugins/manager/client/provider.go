package client

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
)

type Provider struct {
	client      plugins.Client
	middlewares []plugins.ClientMiddleware
}

func ProvideProvider(client *Service) (*Provider, error) {
	middlewares := []plugins.ClientMiddleware{}

	return NewProvider(client, middlewares...)
}

func NewProvider(client plugins.Client, middlewares ...plugins.ClientMiddleware) (*Provider, error) {
	if client == nil {
		return nil, fmt.Errorf("client cannot be nil")
	}

	return &Provider{
		client:      client,
		middlewares: middlewares,
	}, nil
}

func (p *Provider) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	client := clientFromMiddlewares(p.middlewares, p.client)
	return client.QueryData(ctx, req)
}

func (p *Provider) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	client := clientFromMiddlewares(p.middlewares, p.client)
	return client.CallResource(ctx, req, sender)
}

func (p *Provider) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	client := clientFromMiddlewares(p.middlewares, p.client)
	return client.CollectMetrics(ctx, req)
}

func (p *Provider) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	client := clientFromMiddlewares(p.middlewares, p.client)
	return client.CheckHealth(ctx, req)
}

func (p *Provider) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	client := clientFromMiddlewares(p.middlewares, p.client)
	return client.SubscribeStream(ctx, req)
}

func (p *Provider) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	client := clientFromMiddlewares(p.middlewares, p.client)
	return client.PublishStream(ctx, req)
}

func (p *Provider) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	client := clientFromMiddlewares(p.middlewares, p.client)
	return client.RunStream(ctx, req, sender)
}

func clientFromMiddlewares(middlewares []plugins.ClientMiddleware, finalClient plugins.Client) plugins.Client {
	if len(middlewares) == 0 {
		return finalClient
	}

	reversed := reverseMiddlewares(middlewares)
	next := finalClient

	for _, m := range reversed {
		next = m.CreateClientMiddleware(next)
	}

	return next
}

func reverseMiddlewares(middlewares []plugins.ClientMiddleware) []plugins.ClientMiddleware {
	reversed := make([]plugins.ClientMiddleware, len(middlewares))
	copy(reversed, middlewares)

	for i, j := 0, len(reversed)-1; i < j; i, j = i+1, j-1 {
		reversed[i], reversed[j] = reversed[j], reversed[i]
	}

	return reversed
}

var _ plugins.Client = &Provider{}

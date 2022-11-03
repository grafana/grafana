package client

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

func NewForwardOAuthTokenMiddleware(oAuthTokenService oauthtoken.OAuthTokenService) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &ForwardOAuthTokenMiddleware{
			next:              next,
			oAuthTokenService: oAuthTokenService,
		}
	})
}

type ForwardOAuthTokenMiddleware struct {
	oAuthTokenService oauthtoken.OAuthTokenService
	next              plugins.Client
}

func (m *ForwardOAuthTokenMiddleware) applyToken(ctx context.Context, pCtx backend.PluginContext, req interface{}) (context.Context, error) {
	reqCtx := contexthandler.FromContext(ctx)
	// if request not for a datasource or no HTTP request context skip middleware
	if req == nil || pCtx.DataSourceInstanceSettings == nil || reqCtx == nil || reqCtx.Req == nil {
		return nil, nil
	}

	settings := pCtx.DataSourceInstanceSettings

	// need oauth pass through set defined in the SDK, for now just dummy
	opts, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	jsonData := backend.JSONDataFromHTTPClientOptions(opts)
	ds := &datasources.DataSource{
		Id:       settings.ID,
		OrgId:    pCtx.OrgID,
		JsonData: simplejson.NewFromAny(jsonData),
		Updated:  settings.Updated,
	}

	if m.oAuthTokenService.IsOAuthPassThruEnabled(ds) {
		if token := m.oAuthTokenService.GetCurrentOAuthToken(ctx, reqCtx.SignedInUser); token != nil {
			authorizationHeader := fmt.Sprintf("%s %s", token.Type(), token.AccessToken)
			idTokenHeader := ""

			idToken, ok := token.Extra("id_token").(string)
			if ok && idToken != "" {
				idTokenHeader = idToken
			}

			switch t := req.(type) {
			case *backend.QueryDataRequest:
			case *backend.CheckHealthRequest:
				t.Headers["Authorization"] = authorizationHeader
				if idTokenHeader != "" {
					t.Headers["X-ID-Token"] = idTokenHeader
				}
			case *backend.CallResourceRequest:
				t.Headers["Authorization"] = []string{authorizationHeader}
				if idTokenHeader != "" {
					t.Headers["X-ID-Token"] = []string{idTokenHeader}
				}
			}

			ctx = httpclient.WithContextualMiddleware(ctx, httpclientprovider.ForwardedOAuthIdentityMiddleware(token))
		}
	}

	return ctx, nil
}

func (m *ForwardOAuthTokenMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	newCtx, err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.QueryData(newCtx, req)
}

func (m *ForwardOAuthTokenMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	newCtx, err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.next.CallResource(newCtx, req, sender)
}

func (m *ForwardOAuthTokenMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *ForwardOAuthTokenMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	newCtx, err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.CheckHealth(newCtx, req)
}

func (m *ForwardOAuthTokenMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *ForwardOAuthTokenMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *ForwardOAuthTokenMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

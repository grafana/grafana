package clientmiddleware

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

// NewOAuthTokenMiddleware creates a new plugins.ClientMiddleware that will
// set OAuth token headers on outgoing plugins.Client and HTTP requests if
// the datasource has enabled Forward OAuth Identity (oauthPassThru).
func NewOAuthTokenMiddleware(oAuthTokenService oauthtoken.OAuthTokenService) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &OAuthTokenMiddleware{
			next:              next,
			oAuthTokenService: oAuthTokenService,
		}
	})
}

const (
	tokenHeaderName   = "Authorization"
	idTokenHeaderName = "X-ID-Token"
)

type OAuthTokenMiddleware struct {
	oAuthTokenService oauthtoken.OAuthTokenService
	next              plugins.Client
}

func (m *OAuthTokenMiddleware) applyToken(ctx context.Context, pCtx backend.PluginContext, req interface{}) (context.Context, error) {
	reqCtx := contexthandler.FromContext(ctx)
	// if request not for a datasource or no HTTP request context skip middleware
	if req == nil || pCtx.DataSourceInstanceSettings == nil || reqCtx == nil || reqCtx.Req == nil {
		return ctx, nil
	}

	settings := pCtx.DataSourceInstanceSettings
	jsonDataBytes, err := simplejson.NewJson(settings.JSONData)
	if err != nil {
		return ctx, err
	}

	ds := &datasources.DataSource{
		Id:       settings.ID,
		OrgId:    pCtx.OrgID,
		JsonData: jsonDataBytes,
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
				t.Headers[tokenHeaderName] = authorizationHeader
				if idTokenHeader != "" {
					t.Headers[idTokenHeaderName] = idTokenHeader
				}
			case *backend.CheckHealthRequest:
				t.Headers[tokenHeaderName] = authorizationHeader
				if idTokenHeader != "" {
					t.Headers[idTokenHeaderName] = idTokenHeader
				}
			case *backend.CallResourceRequest:
				t.Headers[tokenHeaderName] = []string{authorizationHeader}
				if idTokenHeader != "" {
					t.Headers[idTokenHeaderName] = []string{idTokenHeader}
				}
			}

			httpHeaders := http.Header{}
			httpHeaders.Set(tokenHeaderName, authorizationHeader)

			if idTokenHeader != "" {
				httpHeaders.Set(idTokenHeaderName, idTokenHeader)
			}

			ctx = httpclient.WithContextualMiddleware(ctx, httpclientprovider.SetHeadersMiddleware(httpHeaders))
		}
	}

	return ctx, nil
}

func (m *OAuthTokenMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	newCtx, err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.QueryData(newCtx, req)
}

func (m *OAuthTokenMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	newCtx, err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.next.CallResource(newCtx, req, sender)
}

func (m *OAuthTokenMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	newCtx, err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.CheckHealth(newCtx, req)
}

func (m *OAuthTokenMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *OAuthTokenMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *OAuthTokenMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *OAuthTokenMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

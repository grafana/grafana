package clientmiddleware

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

// NewOAuthTokenMiddleware creates a new backend.HandlerMiddleware that will
// set OAuth token headers on outgoing backend.Handler requests if the
// datasource has enabled Forward OAuth Identity (oauthPassThru).
func NewOAuthTokenMiddleware(oAuthTokenService oauthtoken.OAuthTokenService) backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &OAuthTokenMiddleware{
			BaseHandler:       backend.NewBaseHandler(next),
			oAuthTokenService: oAuthTokenService,
		}
	})
}

type OAuthTokenMiddleware struct {
	backend.BaseHandler
	oAuthTokenService oauthtoken.OAuthTokenService
}

func (m *OAuthTokenMiddleware) applyToken(ctx context.Context, pCtx backend.PluginContext, req interface{}) error {
	reqCtx := contexthandler.FromContext(ctx)
	// if request not for a datasource or no HTTP request context skip middleware
	if req == nil || pCtx.DataSourceInstanceSettings == nil || reqCtx == nil || reqCtx.Req == nil {
		return nil
	}

	settings := pCtx.DataSourceInstanceSettings
	jsonDataBytes, err := simplejson.NewJson(settings.JSONData)
	if err != nil {
		return err
	}

	ds := &datasources.DataSource{
		ID:       settings.ID,
		OrgID:    pCtx.OrgID,
		JsonData: jsonDataBytes,
		Updated:  settings.Updated,
	}

	if m.oAuthTokenService.IsOAuthPassThruEnabled(ds) {
		if token := m.oAuthTokenService.GetCurrentOAuthToken(ctx, reqCtx.SignedInUser, reqCtx.UserToken); token != nil {
			authorizationHeader := fmt.Sprintf("%s %s", token.Type(), token.AccessToken)
			idTokenHeader := ""

			idToken, ok := token.Extra("id_token").(string)
			if ok && idToken != "" {
				idTokenHeader = idToken
			}

			switch t := req.(type) {
			case *backend.QueryDataRequest:
				t.Headers[backend.OAuthIdentityTokenHeaderName] = authorizationHeader
				if idTokenHeader != "" {
					t.Headers[backend.OAuthIdentityIDTokenHeaderName] = idTokenHeader
				}
			case *backend.CheckHealthRequest:
				t.Headers[backend.OAuthIdentityTokenHeaderName] = authorizationHeader
				if idTokenHeader != "" {
					t.Headers[backend.OAuthIdentityIDTokenHeaderName] = idTokenHeader
				}
			case *backend.CallResourceRequest:
				t.Headers[backend.OAuthIdentityTokenHeaderName] = []string{authorizationHeader}
				if idTokenHeader != "" {
					t.Headers[backend.OAuthIdentityIDTokenHeaderName] = []string{idTokenHeader}
				}
			}
		}
	}

	return nil
}

func (m *OAuthTokenMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *OAuthTokenMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *OAuthTokenMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.BaseHandler.CheckHealth(ctx, req)
}

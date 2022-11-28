package query

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"golang.org/x/oauth2"
)

type parsedQuery struct {
	datasource *datasources.DataSource
	query      backend.DataQuery
}

type parsedRequest struct {
	hasExpression bool
	parsedQueries []parsedQuery
	httpRequest   *http.Request
}

func (pr parsedRequest) createDataSourceQueryEnrichers(ctx context.Context, signedInUser *user.SignedInUser, oAuthTokenService oauthtoken.OAuthTokenService, disallowedCookies []string) map[string]expr.QueryDataRequestEnricher {
	datasourcesHeaderProvider := map[string]expr.QueryDataRequestEnricher{}

	if pr.httpRequest == nil {
		return datasourcesHeaderProvider
	}

	if len(pr.parsedQueries) == 0 || pr.parsedQueries[0].datasource == nil {
		return datasourcesHeaderProvider
	}

	for _, q := range pr.parsedQueries {
		ds := q.datasource
		uid := ds.Uid

		if expr.IsDataSource(uid) {
			continue
		}

		if _, exists := datasourcesHeaderProvider[uid]; exists {
			continue
		}

		allowedCookies := ds.AllowedCookies()
		clonedReq := pr.httpRequest.Clone(pr.httpRequest.Context())

		var token *oauth2.Token
		if oAuthTokenService.IsOAuthPassThruEnabled(ds) {
			token = oAuthTokenService.GetCurrentOAuthToken(ctx, signedInUser)
		}

		datasourcesHeaderProvider[uid] = func(ctx context.Context, req *backend.QueryDataRequest) context.Context {
			if len(req.Headers) == 0 {
				req.Headers = map[string]string{}
			}

			if len(allowedCookies) > 0 {
				proxyutil.ClearCookieHeader(clonedReq, allowedCookies, disallowedCookies)
				if cookieStr := clonedReq.Header.Get("Cookie"); cookieStr != "" {
					req.Headers["Cookie"] = cookieStr
				}

				ctx = httpclient.WithContextualMiddleware(ctx, httpclientprovider.ForwardedCookiesMiddleware(clonedReq.Cookies(), allowedCookies, disallowedCookies))
			}

			if token != nil {
				req.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)

				idToken, ok := token.Extra("id_token").(string)
				if ok && idToken != "" {
					req.Headers["X-ID-Token"] = idToken
				}

				ctx = httpclient.WithContextualMiddleware(ctx, httpclientprovider.ForwardedOAuthIdentityMiddleware(token))
			}

			return ctx
		}
	}

	return datasourcesHeaderProvider
}

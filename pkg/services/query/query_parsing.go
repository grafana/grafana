package query

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/components/simplejson"
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
	rawQuery   *simplejson.Json
}

type parsedRequest struct {
	hasExpression bool
	parsedQueries map[string][]parsedQuery
	dsTypes       map[string]bool
	httpRequest   *http.Request
}

func (pr parsedRequest) getFlattenedQueries() []parsedQuery {
	queries := make([]parsedQuery, 0)
	for _, pq := range pr.parsedQueries {
		queries = append(queries, pq...)
	}
	return queries
}

func (pr parsedRequest) validateRequest() error {
	if pr.httpRequest == nil {
		return nil
	}

	if pr.hasExpression {
		hasExpr := pr.httpRequest.URL.Query().Get("expression")
		if hasExpr == "" || hasExpr == "true" {
			return nil
		}
		return ErrQueryParamMismatch
	}

	vals := splitHeaders(pr.httpRequest.Header.Values(HeaderDatasourceUID))
	count := len(vals)
	if count > 0 { // header exists
		if count != len(pr.parsedQueries) {
			return ErrQueryParamMismatch
		}
		for _, t := range vals {
			if pr.parsedQueries[t] == nil {
				return ErrQueryParamMismatch
			}
		}
	}

	vals = splitHeaders(pr.httpRequest.Header.Values(HeaderPluginID))
	count = len(vals)
	if count > 0 { // header exists
		if count != len(pr.dsTypes) {
			return ErrQueryParamMismatch
		}
		for _, t := range vals {
			if !pr.dsTypes[t] {
				return ErrQueryParamMismatch
			}
		}
	}
	return nil
}

func (pr parsedRequest) createDataSourceQueryEnrichers(ctx context.Context, signedInUser *user.SignedInUser, oAuthTokenService oauthtoken.OAuthTokenService, disallowedCookies []string) map[string]expr.QueryDataRequestEnricher {
	datasourcesHeaderProvider := map[string]expr.QueryDataRequestEnricher{}

	if pr.httpRequest == nil {
		return datasourcesHeaderProvider
	}

	for uid, queries := range pr.parsedQueries {
		if expr.IsDataSource(uid) {
			continue
		}

		if len(queries) == 0 || queries[0].datasource == nil {
			continue
		}

		if _, exists := datasourcesHeaderProvider[uid]; exists {
			continue
		}

		ds := queries[0].datasource
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

func splitHeaders(headers []string) []string {
	out := []string{}
	for _, v := range headers {
		if strings.Contains(v, ",") {
			for _, sub := range strings.Split(v, ",") {
				out = append(out, strings.TrimSpace(sub))
			}
		} else {
			out = append(out, v)
		}
	}
	return out
}

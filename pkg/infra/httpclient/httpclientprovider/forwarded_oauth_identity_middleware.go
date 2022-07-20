package httpclientprovider

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"golang.org/x/oauth2"
)

const ForwardedOAuthIdentityMiddlewareName = "forwarded-oauth-identity"

// ForwardedOAuthIdentityMiddleware middleware that sets Authorization/X-ID-Token
// headers on the outgoing request if an OAuth Token is provided
func ForwardedOAuthIdentityMiddleware(token *oauth2.Token) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(ForwardedOAuthIdentityMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		if token == nil {
			return next
		}
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			req.Header.Set("Authorization", fmt.Sprintf("%s %s", token.Type(), token.AccessToken))

			idToken, ok := token.Extra("id_token").(string)
			if ok && idToken != "" {
				req.Header.Set("X-ID-Token", idToken)
			}

			return next.RoundTrip(req)
		})
	})
}

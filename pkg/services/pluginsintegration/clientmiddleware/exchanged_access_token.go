package clientmiddleware

import "context"

// AccessTokenHeaderName is the header that carries an exchanged access token to
// a plugin.
const AccessTokenHeaderName = "X-Access-Token"

type exchangedAccessTokenKey struct{}

// WithExchangedAccessToken marks ctx as belonging to a plugin request whose
// caller identity is an access token, exchanged for the caller and set in the
// X-Access-Token header by an outer middleware (as the router does for v2 app
// settings calls, the way plugin protocol v3 calls are authenticated).
//
// That token is then the request's only identity: the middlewares below leave
// it in place, and do not add another identity for the plugin to choose
// between, such as the ID token in X-Grafana-Id.
func WithExchangedAccessToken(ctx context.Context) context.Context {
	return context.WithValue(ctx, exchangedAccessTokenKey{}, true)
}

// hasExchangedAccessToken reports whether ctx was marked by
// WithExchangedAccessToken.
func hasExchangedAccessToken(ctx context.Context) bool {
	v, _ := ctx.Value(exchangedAccessTokenKey{}).(bool)
	return v
}

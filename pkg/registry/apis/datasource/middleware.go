package datasource

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const forwardPluginRequestHTTPHeaders = "contextual-middlewares"

func contextualMiddlewares(ctx context.Context) context.Context {
	cfg := backend.GrafanaConfigFromContext(ctx)
	m := httpclient.ResponseLimitMiddleware(cfg.ResponseLimit())
	mw := httpclient.NamedMiddlewareFunc(forwardPluginRequestHTTPHeaders, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return m.CreateMiddleware(opts, next)
	})

	return httpclient.WithContextualMiddleware(ctx, mw)
}

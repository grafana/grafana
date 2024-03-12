package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

func contextualMiddlewares(ctx context.Context) context.Context {
	cfg := backend.GrafanaConfigFromContext(ctx)
	m := httpclient.ResponseLimitMiddleware(cfg.ResponseLimit())

	return httpclient.WithContextualMiddleware(ctx, m)
}

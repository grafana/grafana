package datasource

import (
	"context"

	"github.com/grafana/grafana-aws-sdk/pkg/awsauth"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

func contextualMiddlewares(ctx context.Context) context.Context {
	cfg := backend.GrafanaConfigFromContext(ctx)
	responseLimitMiddleware := httpclient.ResponseLimitMiddleware(cfg.ResponseLimit())
	ctx = httpclient.WithContextualMiddleware(ctx, responseLimitMiddleware)

	sigv4Settings := awsds.ReadSigV4Settings(ctx)
	if sigv4Settings.Enabled {
		ctx = httpclient.WithContextualMiddleware(ctx, awsauth.NewSigV4Middleware())
	}

	return ctx
}

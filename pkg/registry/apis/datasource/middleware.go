package datasource

import (
	"context"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-aws-sdk/pkg/sigv4"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

func contextualMiddlewares(ctx context.Context) context.Context {
	cfg := backend.GrafanaConfigFromContext(ctx)
	responseLimitMiddleware := httpclient.ResponseLimitMiddleware(cfg.ResponseLimit())
	ctx = httpclient.WithContextualMiddleware(ctx, responseLimitMiddleware)

	sigv4Settings := awsds.ReadSigV4Settings(ctx)
	if sigv4Settings.Enabled {
		authSettings, _ := awsds.ReadAuthSettingsFromContext(ctx)
		ctx = httpclient.WithContextualMiddleware(ctx, sigv4.SigV4MiddlewareWithAuthSettings(sigv4Settings.VerboseLogging, *authSettings))
	}

	return ctx
}

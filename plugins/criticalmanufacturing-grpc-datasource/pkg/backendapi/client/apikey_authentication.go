package client

import "context"

const apiKeyHeader = "api-key"

type ApiKeyAuthenticator struct {
	ApiKey string
}

func (t ApiKeyAuthenticator) GetRequestMetadata(ctx context.Context, in ...string) (map[string]string, error) {
	return map[string]string{
		apiKeyHeader: t.ApiKey,
	}, nil
}

func (ApiKeyAuthenticator) RequireTransportSecurity() bool {
	return true
}

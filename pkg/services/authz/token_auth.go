package authz

import (
	"context"

	"github.com/grafana/authlib/authn"
)

// TODO: move this to authlib
func NewGRPCTokenAuth(audience, namespace string, tc authn.TokenExchanger) *tokenAuth {
	return &tokenAuth{audience, namespace, tc}
}

type tokenAuth struct {
	audience    string
	namespace   string
	tokenClient authn.TokenExchanger
}

func (t *tokenAuth) GetRequestMetadata(ctx context.Context, _ ...string) (map[string]string, error) {
	token, err := t.tokenClient.Exchange(ctx, authn.TokenExchangeRequest{
		Namespace: t.namespace,
		Audiences: []string{t.audience},
	})
	if err != nil {
		return nil, err
	}

	const metadataKey = "X-Access-Token"

	return map[string]string{metadataKey: token.Token}, nil
}

func (t *tokenAuth) RequireTransportSecurity() bool { return false }

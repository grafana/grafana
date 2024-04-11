package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Client = (*IdentityClient)(nil)

func ProvideIdentity(identity *authn.Identity) *IdentityClient {
	return &IdentityClient{identity}
}

type IdentityClient struct {
	identity *authn.Identity
}

func (i *IdentityClient) Name() string {
	return "identity"
}

func (i *IdentityClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return i.identity, nil

}

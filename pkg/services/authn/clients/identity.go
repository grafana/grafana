package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
)

var _ authn.Client = (*IdentityClient)(nil)

func ProvideIdentity(namespaceID string) *IdentityClient {
	return &IdentityClient{namespaceID}
}

type IdentityClient struct {
	namespaceID string
}

func (i *IdentityClient) Name() string {
	return "identity"
}

// Authenticate implements authn.Client.
func (i *IdentityClient) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return &authn.Identity{
		OrgID: r.OrgID,
		ID:    i.namespaceID,
		ClientParams: authn.ClientParams{
			AllowGlobalOrg:  true,
			FetchSyncedUser: true,
			SyncPermissions: true,
		},
	}, nil
}

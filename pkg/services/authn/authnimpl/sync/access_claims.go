package sync

import (
	"context"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authn"
)

func NewAccessClaimsSync() AccessClaimsSync {
	return AccessClaimsSync{}
}

type AccessClaimsSync struct{}

func AccessClaimsHook(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	if id.AccessTokenClaims == nil {
		// When normal authencation flows are used withint grafana we don't have any access token e.g. using user
		// session. This makes it impossible to authorize using AccessClient because we don't have any access claims
		// with deletegated permissions. To get around this we use the hardcoded delegated
		// permissions.
		id.AccessTokenClaims = &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
			},
		}
	}

	return nil
}

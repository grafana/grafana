package auth

import (
	"context"

	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type IDService interface {
	// SignIdentity signs a id token for provided identity that can be forwarded to plugins and external services
	SignIdentity(ctx context.Context, identity identity.Requester) (string, error)
}

type IDSigner interface {
	SignIDToken(ctx context.Context, claims *IDClaims) (string, error)
}

type IDClaims struct {
	jwt.Claims
	AuthenticatedBy string `json:"authenticatedBy,omitempty"`
}

const settingsKey = "forwardGrafanaIdToken"

func IsIDForwardingEnabledForDataSource(ds *datasources.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get(settingsKey).MustBool()
}

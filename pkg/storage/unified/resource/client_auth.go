package resource

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	// defaultResourceStoreAudience is the default audience for resource store tokens
	defaultResourceStoreAudience = "resourceStore"
	// defaultTokenIssuer is the default issuer for in-process tokens
	defaultTokenIssuer = "grafana"
	// defaultTokenNamespace is the wildcard namespace for service tokens ('*' means all namespaces)
	defaultTokenNamespace = "*"
)

var authLogger = log.New("resource-client-auth-interceptor")

// idTokenExtractor extracts ID tokens from the request context for authentication.
// Returns empty string for service identities or when no ID token is available.
func idTokenExtractor(ctx context.Context) (string, error) {
	if identity.IsServiceIdentity(ctx) {
		return "", nil
	}

	info, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return "", fmt.Errorf("no claims found")
	}

	// If the identity is the service identity, we don't need to extract the ID token
	if info.GetIdentityType() == types.TypeAccessPolicy {
		return "", nil
	}

	if token := info.GetIDToken(); len(token) != 0 {
		return token, nil
	}

	authLogger.FromContext(ctx).Warn(
		"calling resource store as the service without id token or marking it as the service identity",
		"subject", info.GetSubject(),
		"uid", info.GetUID(),
	)

	return "", nil
}

// createInProcToken generates a signed JWT token for in-process authentication.
// This token is used for local channel communication and has full service permissions.
func createInProcToken() (string, error) {
	// Generate ES256 private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to generate ES256 private key: %w", err)
	}

	// Create signer with ES256 algorithm
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: privateKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{
			jose.HeaderKey("typ"): authnlib.TokenTypeAccess,
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to create signer: %w", err)
	}

	// Create claims
	claims := authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{
			Issuer:   defaultTokenIssuer,
			Subject:  types.NewTypeID(types.TypeAccessPolicy, defaultTokenIssuer),
			Audience: []string{defaultResourceStoreAudience},
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace:            defaultTokenNamespace,
			Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
			DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
		},
	}

	// Sign and create the JWT
	token, err := jwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return token, nil
}

// provideInProcExchanger creates a static token exchanger for in-process communication
func provideInProcExchanger() authnlib.StaticTokenExchanger {
	token, err := createInProcToken()
	if err != nil {
		panic(err)
	}

	return authnlib.NewStaticTokenExchanger(token)
}

package tokenstoreserver

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// NewInProcTokenExchanger returns an exchanger for use with NewInProcChannel.
//
// Unified storage has an equivalent helper, but importing it here would pull the
// whole unified storage package in for one function and point this store at an
// unrelated subsystem, so the token is minted locally instead.
//
// The token is cluster-scoped: the request carries the namespace and the authz check
// accepts "*". The key is generated per process and never leaves it, and the paired
// server parses claims without verifying the signature.
func NewInProcTokenExchanger() (authnlib.TokenExchanger, error) {
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating in-process signing key: %w", err)
	}

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: privateKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{
			jose.HeaderKey("typ"): authnlib.TokenTypeAccess,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("creating in-process signer: %w", err)
	}

	token, err := jwt.Signed(signer).Claims(authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{
			Issuer:  "grafana",
			Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana"),
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace:            "*",
			Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
			DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
		},
	}).Serialize()
	if err != nil {
		return nil, fmt.Errorf("signing in-process token: %w", err)
	}

	return authnlib.NewStaticTokenExchanger(token), nil
}

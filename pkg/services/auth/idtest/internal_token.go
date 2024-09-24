package idtest

import (
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/services/auth"
)

func CreateInternalToken(authInfo claims.AuthInfo, secret []byte) (string, *authnlib.Claims[authnlib.IDTokenClaims], error) {
	signerOpts := jose.SignerOptions{}
	signerOpts.WithType("jwt") // Should be uppercase, but this is what authlib expects
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.HS256, Key: secret}, &signerOpts)
	if err != nil {
		return "", nil, err
	}

	identity := authInfo.GetIdentity()
	now := time.Now()
	tokenTTL := 10 * time.Minute
	idClaims := &auth.IDClaims{
		Claims: &jwt.Claims{
			Audience: identity.Audience(),
			Subject:  identity.Subject(),
			Expiry:   jwt.NewNumericDate(now.Add(tokenTTL)),
			IssuedAt: jwt.NewNumericDate(now),
		},
		Rest: authnlib.IDTokenClaims{
			Namespace:  identity.Namespace(),
			Identifier: identity.Identifier(),
			Type:       identity.IdentityType(),
		},
	}

	if claims.IsIdentityType(identity.IdentityType(), claims.TypeUser) {
		idClaims.Rest.Email = identity.Email()
		idClaims.Rest.EmailVerified = identity.EmailVerified()
		idClaims.Rest.AuthenticatedBy = identity.AuthenticatedBy()
		idClaims.Rest.Username = identity.Username()
		idClaims.Rest.DisplayName = identity.DisplayName()
	}

	builder := jwt.Signed(signer).Claims(&idClaims.Rest).Claims(idClaims.Claims)
	token, err := builder.CompactSerialize()
	if err != nil {
		return "", nil, err
	}

	return token, idClaims, nil
}

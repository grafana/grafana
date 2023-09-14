package idsignerimpl

import (
	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

func newLocalSigner(signingKeyService signingkeys.Service) (*localSigner, error) {
	key := signingKeyService.GetServerPrivateKey() // FIXME: replace with signing specific key
	jwk := jose.JSONWebKey{
		Key:       key,
		KeyID:     "id-signer",
		Algorithm: string(jose.ES256),
	}

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.SignatureAlgorithm(jwk.Algorithm), Key: jwk.Key}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{
			"kid": jwk.KeyID,
		},
	})
	if err != nil {
		return nil, err
	}

	return &localSigner{
		signer: signer,
		jwk:    jwk,
	}, nil
}

var _ TokenSigner = new(localSigner)

type localSigner struct {
	signer jose.Signer
	jwk    jose.JSONWebKey
}

// GetJWK implements TokenSigner.
func (s *localSigner) GetJWK() jose.JSONWebKey {
	return s.jwk
}

func (s *localSigner) SignToken(claims *jwt.Claims, assertions *auth.IDAssertions) (string, error) {
	builder := jwt.Signed(s.signer).Claims(claims).Claims(assertions)

	// Build the JWT.
	token, err := builder.CompactSerialize()
	if err != nil {
		return "", err
	}

	return token, nil
}

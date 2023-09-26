package idimpl

import (
	"context"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

var _ auth.IDSigner = (*LocalSigner)(nil)

func ProvideLocalSigner(keyService signingkeys.Service) (*LocalSigner, error) {
	key := keyService.GetServerPrivateKey() // FIXME: replace with signing specific key

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{
			"kid": "default", // FIXME: replace with specific key id
		},
	})
	if err != nil {
		return nil, err
	}

	return &LocalSigner{
		signer: signer,
	}, nil
}

type LocalSigner struct {
	signer jose.Signer
}

func (s *LocalSigner) SignIDToken(ctx context.Context, claims *auth.IDClaims) (string, error) {
	builder := jwt.Signed(s.signer).Claims(claims.Claims)

	token, err := builder.CompactSerialize()
	if err != nil {
		return "", err
	}

	return token, nil
}

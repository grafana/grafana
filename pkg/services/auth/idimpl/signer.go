package idimpl

import (
	"context"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

const (
	keyPrefix   = "id"
	headerKeyID = "kid"
)

var _ auth.IDSigner = (*LocalSigner)(nil)

func ProvideLocalSigner(keyService signingkeys.Service) (*LocalSigner, error) {
	return &LocalSigner{keyService}, nil
}

type LocalSigner struct {
	keyService signingkeys.Service
}

func (s *LocalSigner) SignIDToken(ctx context.Context, claims *auth.IDClaims) (string, error) {
	signer, err := s.getSigner(ctx)
	if err != nil {
		return "", err
	}

	builder := jwt.Signed(signer).Claims(&claims.Rest).Claims(claims.Claims)

	token, err := builder.Serialize()
	if err != nil {
		return "", err
	}

	return token, nil
}

func (s *LocalSigner) getSigner(ctx context.Context) (jose.Signer, error) {
	id, key, err := s.keyService.GetOrCreatePrivateKey(ctx, keyPrefix, jose.ES256)
	if err != nil {
		return nil, err
	}

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{
			headerKeyID:     id,
			jose.HeaderType: "jwt",
		},
	})

	if err != nil {
		return nil, err
	}

	return signer, nil
}

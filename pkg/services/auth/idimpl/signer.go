package idimpl

import (
	"context"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

const idSignerKeyPrefix = "id"

var _ auth.IDSigner = (*LocalSigner)(nil)

func ProvideLocalSigner(keyService signingkeys.Service, features featuremgmt.FeatureToggles) (*LocalSigner, error) {
	if features.IsEnabled(featuremgmt.FlagIdForwarding) {
		id, key, err := keyService.GetOrCreatePrivateKey(context.Background(), idSignerKeyPrefix, jose.ES256)
		if err != nil {
			return nil, err
		}

		// FIXME: Handle key rotation
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, &jose.SignerOptions{
			ExtraHeaders: map[jose.HeaderKey]interface{}{
				"kid": id,
			},
		})

		if err != nil {
			return nil, err
		}

		return &LocalSigner{
			features: features,
			signer:   signer,
		}, nil
	}

	return &LocalSigner{features: features}, nil
}

type LocalSigner struct {
	signer   jose.Signer
	features featuremgmt.FeatureToggles
}

func (s *LocalSigner) SignIDToken(ctx context.Context, claims *auth.IDClaims) (string, error) {
	if !s.features.IsEnabled(featuremgmt.FlagIdForwarding) {
		return "", nil
	}

	builder := jwt.Signed(s.signer).Claims(claims.Claims)

	token, err := builder.CompactSerialize()
	if err != nil {
		return "", err
	}

	return token, nil
}

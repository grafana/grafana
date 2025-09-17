package signingkeystest

import (
	"context"
	"crypto"

	"github.com/go-jose/go-jose/v4"
)

type FakeSigningKeysService struct {
	ExpectedJSONWebKeySet jose.JSONWebKeySet
	ExpectedKeyID         string
	ExpectedSigner        crypto.Signer
	ExpectedError         error
}

func (s *FakeSigningKeysService) GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error) {
	return s.ExpectedJSONWebKeySet, nil
}

func (s *FakeSigningKeysService) GetOrCreatePrivateKey(ctx context.Context, keyPrefix string, alg jose.SignatureAlgorithm) (string, crypto.Signer, error) {
	return s.ExpectedKeyID, s.ExpectedSigner, s.ExpectedError
}

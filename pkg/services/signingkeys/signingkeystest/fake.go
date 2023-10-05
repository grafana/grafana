package signingkeystest

import (
	"context"
	"crypto"
	"time"

	"github.com/go-jose/go-jose/v3"
)

type FakeSigningKeysService struct {
	ExpectedJSONWebKeySet jose.JSONWebKeySet
	ExpectedJSONWebKey    jose.JSONWebKey
	ExpectedKeys          map[string]crypto.Signer
	ExpectedError         error
}

func (s *FakeSigningKeysService) GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error) {
	return s.ExpectedJSONWebKeySet, nil
}

// GetPublicKey returns the public key with the specified key ID
func (s *FakeSigningKeysService) GetPublicKey(ctx context.Context, keyID string) (crypto.PublicKey, error) {
	return s.ExpectedKeys[keyID].Public(), s.ExpectedError
}

// GetPrivateKey returns the private key with the specified key ID
func (s *FakeSigningKeysService) GetPrivateKey(ctx context.Context, keyID string) (crypto.PrivateKey, error) {
	return s.ExpectedKeys[keyID], s.ExpectedError
}

// AddPrivateKey adds a private key to the service
func (s *FakeSigningKeysService) AddPrivateKey(ctx context.Context, keyID string,
	privateKey crypto.Signer, alg jose.SignatureAlgorithm, expiresAt *time.Time, force bool) error {
	if s.ExpectedError != nil {
		return s.ExpectedError
	}
	s.ExpectedKeys[keyID] = privateKey
	return nil
}

func (s *FakeSigningKeysService) GetOrCreatePrivateKey(ctx context.Context,
	keyPrefix string, alg jose.SignatureAlgorithm) (string, crypto.Signer, error) {
	if s.ExpectedError != nil {
		return "", nil, s.ExpectedError
	}
	return keyPrefix, s.ExpectedKeys[keyPrefix], nil
}

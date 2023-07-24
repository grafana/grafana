package signingkeystest

import (
	"crypto"

	"github.com/go-jose/go-jose/v3"
)

type FakeSigningKeysService struct {
	ExpectedJSONWebKeySet    jose.JSONWebKeySet
	ExpectedJSONWebKey       jose.JSONWebKey
	ExpectedKeys             map[string]crypto.Signer
	ExpectedServerPrivateKey crypto.PrivateKey
	ExpectedServerPublicKey  crypto.PublicKey
	ExpectedError            error
}

func (s *FakeSigningKeysService) GetJWKS() jose.JSONWebKeySet {
	return s.ExpectedJSONWebKeySet
}

// GetJWK returns the JSON Web Key (JWK) with the specified key ID which can be used to verify tokens (public key)
func (s *FakeSigningKeysService) GetJWK(keyID string) (jose.JSONWebKey, error) {
	return s.ExpectedJSONWebKey, s.ExpectedError
}

// GetPublicKey returns the public key with the specified key ID
func (s *FakeSigningKeysService) GetPublicKey(keyID string) (crypto.PublicKey, error) {
	return s.ExpectedKeys[keyID].Public(), s.ExpectedError
}

// GetPrivateKey returns the private key with the specified key ID
func (s *FakeSigningKeysService) GetPrivateKey(keyID string) (crypto.PrivateKey, error) {
	return s.ExpectedKeys[keyID], s.ExpectedError
}

// GetServerPrivateKey returns the private key used to sign tokens
func (s *FakeSigningKeysService) GetServerPrivateKey() crypto.PrivateKey {
	return s.ExpectedServerPrivateKey
}

// GetServerPublicKey returns the public key used to verify tokens
func (s *FakeSigningKeysService) GetServerPublicKey() crypto.PublicKey {
	return s.ExpectedServerPublicKey
}

// AddPrivateKey adds a private key to the service
func (s *FakeSigningKeysService) AddPrivateKey(keyID string, privateKey crypto.PrivateKey) error {
	if s.ExpectedError != nil {
		return s.ExpectedError
	}
	s.ExpectedKeys[keyID] = privateKey.(crypto.Signer)
	return nil
}

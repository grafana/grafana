// Package signingkeys implements the SigningKeys service which is responsible for managing
// the signing keys used to sign and verify JWT tokens.
//
// The service is under active development and is not yet ready for production use.
//
// Currently, it only supports RSA keys and the keys are stored in memory.

package signingkeys

import (
	"crypto"

	"github.com/go-jose/go-jose/v3"
)

// Service provides functionality for managing signing keys used to sign and verify JWT tokens.
//
// The service is under active development and is not yet ready for production use.
type Service interface {
	// GetJWKS returns the JSON Web Key Set (JWKS) with all the keys that can be used to verify tokens (public keys)
	GetJWKS() jose.JSONWebKeySet
	// GetJWK returns the JSON Web Key (JWK) with the specified key ID which can be used to verify tokens (public key)
	GetJWK(keyID string) (jose.JSONWebKey, error)
	// GetPublicKey returns the public key with the specified key ID
	GetPublicKey(keyID string) (crypto.PublicKey, error)
	// GetPrivateKey returns the private key with the specified key ID
	GetPrivateKey(keyID string) (crypto.PrivateKey, error)
	// GetServerPrivateKey returns the private key used to sign tokens
	GetServerPrivateKey() (crypto.PrivateKey, error)
	// AddPrivateKey adds a private key to the service
	AddPrivateKey(keyID string, privateKey crypto.PrivateKey) error
}

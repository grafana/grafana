// Package signingkeys implements the SigningKeys service which is responsible for managing
// the signing keys used to sign and verify JWT tokens.
//
// The service is under active development and is not yet ready for production use.
//
// Currently, it only supports RSA keys and the keys are stored in memory.

package signingkeys

import (
	"context"
	"crypto"
	"time"

	"github.com/go-jose/go-jose/v4"
)

const (
	ServerPrivateKeyID = "default"
)

// Service provides functionality for managing signing keys used to sign and verify JWT tokens.
//
// The service is under active development and is not yet ready for production use.
type Service interface {
	// GetJWKS returns the JSON Web Key Set (JWKS) with all the keys that can be used to verify tokens (public keys)
	GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error)
	GetOrCreatePrivateKey(ctx context.Context, keyPrefix string, alg jose.SignatureAlgorithm) (string, crypto.Signer, error)
}

type SigningKey struct {
	KeyID      string                  `xorm:"key_id"`
	PrivateKey string                  `xorm:"private_key"`
	AddedAt    time.Time               `xorm:"added_at"`
	ExpiresAt  *time.Time              `xorm:"expires_at"`
	Alg        jose.SignatureAlgorithm `xorm:"alg"`
}

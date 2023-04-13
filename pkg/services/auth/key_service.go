package auth

import (
	"crypto"

	"github.com/go-jose/go-jose/v3"
)

type KeyService interface {
	GetJWKS() jose.JSONWebKeySet
	GetJWK(keyID string) (jose.JSONWebKey, error)
	GetPublicKey(keyID string) (crypto.PublicKey, error)
	GetPrivateKey(keyID string) (crypto.PrivateKey, error)
	GetServerPrivateKey() (crypto.PrivateKey, error)
}

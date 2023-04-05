package auth

import (
	"github.com/go-jose/go-jose/v3"
)

type KeyService interface {
	GetJWKS() (jose.JSONWebKeySet, error)
	GetJWK(keyID string) (jose.JSONWebKey, error)
	GetPublicKey(keyID string) interface{}
	GetPrivateKey(keyID string) interface{}
	GetServerPrivateKey() interface{}
}

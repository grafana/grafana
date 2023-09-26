package signingkeystore

import (
	"context"
	"crypto"
	"fmt"
	"time"

	"github.com/go-jose/go-jose/v3"
)

type FakeStore struct {
	privateKeys map[string]crypto.Signer
	jwks        jose.JSONWebKeySet
}

func NewFakeStore() *FakeStore {
	return &FakeStore{
		privateKeys: make(map[string]crypto.Signer),
		jwks:        jose.JSONWebKeySet{},
	}
}

func (s *FakeStore) GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error) {
	return s.jwks, nil
}

func (s *FakeStore) AddPrivateKey(ctx context.Context, keyID string, alg jose.SignatureAlgorithm, privateKey crypto.Signer, expiresAt *time.Time, force bool) error {
	if !force {
		if key, ok := s.privateKeys[keyID]; ok {
			if !hasExpired(key) {
				return fmt.Errorf("key already exists and has not expired")
			}
		}
	}

	s.privateKeys[keyID] = privateKey

	jwk := jose.JSONWebKey{
		Key:       privateKey.Public(),
		Algorithm: string(alg),
		KeyID:     keyID,
		Use:       "sig",
	}

	s.jwks.Keys = append(s.jwks.Keys, jwk)

	return nil
}

func (s *FakeStore) GetPrivateKey(ctx context.Context, keyID string) (crypto.Signer, error) {
	if key, ok := s.privateKeys[keyID]; ok {
		return key, nil
	}

	return nil, fmt.Errorf("key not found")
}

func hasExpired(key crypto.Signer) bool {
	return false
}

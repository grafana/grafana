package signingkeysimpl

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"

	"github.com/go-jose/go-jose/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

const (
	serverPrivateKeyID = "default"
)

var _ signingkeys.Service = new(Service)

func ProvideEmbeddedSigningKeysService() (*Service, error) {
	s := &Service{
		log:  log.New("auth.key_service"),
		keys: map[string]crypto.Signer{},
	}

	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		s.log.Error("Error generating private key", "err", err)
		return nil, signingkeys.ErrKeyGenerationFailed.Errorf("Error generating private key: %v", err)
	}

	if err := s.AddPrivateKey(serverPrivateKeyID, privateKey); err != nil {
		return nil, err
	}

	return s, nil
}

// Service provides functionality for managing signing keys used to sign and verify JWT tokens for
// the OSS version of Grafana.
//
// The service is under active development and is not yet ready for production use.
type Service struct {
	log  log.Logger
	keys map[string]crypto.Signer
}

// GetJWKS returns the JSON Web Key Set (JWKS) with all the keys that can be used to verify tokens (public keys)
func (s *Service) GetJWKS() jose.JSONWebKeySet {
	result := jose.JSONWebKeySet{}

	for keyID := range s.keys {
		// Skip error check because keyID must be a valid key ID
		jwk, _ := s.GetJWK(keyID)
		result.Keys = append(result.Keys, jwk)
	}

	return result
}

// GetJWK returns the JSON Web Key (JWK) with the specified key ID which can be used to verify tokens (public key)
func (s *Service) GetJWK(keyID string) (jose.JSONWebKey, error) {
	privateKey, ok := s.keys[keyID]
	if !ok {
		s.log.Error("The specified key was not found", "keyID", keyID)
		return jose.JSONWebKey{}, signingkeys.ErrSigningKeyNotFound.Errorf("The specified key was not found: %s", keyID)
	}

	result := jose.JSONWebKey{
		Key: privateKey.Public(),
		Use: "sig",
	}

	return result, nil
}

// GetPublicKey returns the public key with the specified key ID
func (s *Service) GetPublicKey(keyID string) (crypto.PublicKey, error) {
	privateKey, ok := s.keys[keyID]
	if !ok {
		s.log.Error("The specified key was not found", "keyID", keyID)
		return nil, signingkeys.ErrSigningKeyNotFound.Errorf("The specified key was not found: %s", keyID)
	}

	return privateKey.Public(), nil
}

// GetPrivateKey returns the private key with the specified key ID
func (s *Service) GetPrivateKey(keyID string) (crypto.PrivateKey, error) {
	privateKey, ok := s.keys[keyID]
	if !ok {
		s.log.Error("The specified key was not found", "keyID", keyID)
		return nil, signingkeys.ErrSigningKeyNotFound.Errorf("The specified key was not found: %s", keyID)
	}

	return privateKey, nil
}

// AddPrivateKey adds a private key to the service
func (s *Service) AddPrivateKey(keyID string, privateKey crypto.PrivateKey) error {
	if _, ok := s.keys[keyID]; ok {
		s.log.Error("The specified key ID is already in use", "keyID", keyID)
		return signingkeys.ErrSigningKeyAlreadyExists.Errorf("The specified key ID is already in use: %s", keyID)
	}
	s.keys[keyID] = privateKey.(crypto.Signer)
	return nil
}

// GetServerPrivateKey returns the private key used to sign tokens
func (s *Service) GetServerPrivateKey() crypto.PrivateKey {
	// The server private key is always available
	pk, _ := s.GetPrivateKey(serverPrivateKeyID)
	return pk
}

// GetServerPrivateKey returns the private key used to sign tokens
func (s *Service) GetServerPublicKey() crypto.PublicKey {
	// The server public key is always available
	publicKey, _ := s.GetPublicKey(serverPrivateKeyID)
	return publicKey
}

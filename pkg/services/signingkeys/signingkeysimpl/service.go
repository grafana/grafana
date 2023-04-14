package signingkeysimpl

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"

	"github.com/go-jose/go-jose/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

const (
	serverPrivateKeyID = "default"
)

var _ signingkeys.Service = new(Service)

func ProvideEmbeddedSigningKeysService() *Service {
	s := &Service{
		log: log.New("auth.key_service"),
	}

	privateKey, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		s.log.Error("Error generating private key", "err", err)
	}

  s.keys = map[string]crypto.Signer{serverPrivateKeyID: privateKey}

	return s
}

type Service struct {
	log  log.Logger
	keys map[string]crypto.Signer
}

func (s *Service) GetJWKS() jose.JSONWebKeySet {
	result := jose.JSONWebKeySet{}

	for keyID := range s.keys {
		// Skip error check because keyID must be a valid key ID
		jwk, _ := s.GetJWK(keyID)
		result.Keys = append(result.Keys, jwk)
	}

	return result
}

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

func (s *Service) GetPublicKey(keyID string) (crypto.PublicKey, error) {
	privateKey, ok := s.keys[keyID]
	if !ok {
		s.log.Error("The specified key was not found", "keyID", keyID)
		return nil, signingkeys.ErrSigningKeyNotFound.Errorf("The specified key was not found: %s", keyID)
	}

	return privateKey.Public(), nil
}

func (s *Service) GetPrivateKey(keyID string) (crypto.PrivateKey, error) {
	privateKey, ok := s.keys[keyID]
	if !ok {
		s.log.Error("The specified key was not found", "keyID", keyID)
		return nil, signingkeys.ErrSigningKeyNotFound.Errorf("The specified key was not found: %s", keyID)
	}

	return privateKey, nil
}

func (s *Service) GetServerPrivateKey() (crypto.PrivateKey, error) {
	return s.GetPrivateKey(serverPrivateKeyID)
}

package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"time"

	"github.com/go-jose/go-jose/v3"

	"github.com/grafana/grafana/pkg/infra/log"
)

type KeyService interface {
	GetJWKS() (jose.JSONWebKeySet, error)
	GetJWK(keyID string) (jose.JSONWebKey, error)
	GetPublicKey(keyID string) interface{}
	GetPrivateKey(privateKeyID string) interface{}
}

var _ KeyService = new(OSSKeyService)

func ProvideOSSKeyService() *OSSKeyService {
	s := &OSSKeyService{
		log: log.New("auth.key_service"),
	}

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		s.log.Error("Error generating private key", "err", err)
	}

	s.keys = map[string]*rsa.PrivateKey{}
	s.keys["default"] = privateKey

	return s
}

type OSSKeyService struct {
	log  log.Logger
	keys map[string]*rsa.PrivateKey
}

func (s *OSSKeyService) GetJWKS() (jose.JSONWebKeySet, error) {
	// TODO
	return jose.JSONWebKeySet{}, nil
}

func (s *OSSKeyService) GetJWK(keyID string) (jose.JSONWebKey, error) {
	privateKey := s.keys[keyID]

	serialNumber, err := rand.Int(rand.Reader, big.NewInt(100))
	if err != nil {
		s.log.Error("Error generating serial number", "err", err)
		return jose.JSONWebKey{}, err
	}

	certificateBoilerplate := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"Grafana"},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(2 * time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &certificateBoilerplate, &certificateBoilerplate, &privateKey.PublicKey, privateKey)
	if err != nil {
		s.log.Error("Error creating certificate from boilerplate", "err", err)
		return jose.JSONWebKey{}, err
	}

	certificate, err := x509.ParseCertificate(derBytes)

	if err != nil {
		s.log.Error("Error parsing certificate", "err", err)
		return jose.JSONWebKey{}, err
	}

	jwk := jose.JSONWebKey{
		Certificates: []*x509.Certificate{certificate},
		Key:          &privateKey.PublicKey,
		KeyID:        keyID,
		Use:          "sig",
	}

	return jwk, nil
}

func (s *OSSKeyService) GetPublicKey(keyID string) interface{} {
	privateKey, ok := s.keys[keyID]
	if !ok {
		s.log.Error("The specified key was not found", "keyID", keyID)
		return nil
	}

	return &privateKey.PublicKey
}

func (s *OSSKeyService) GetPrivateKey(keyID string) interface{} {
	privateKey, ok := s.keys[keyID]
	if !ok {
		s.log.Error("The specified key was not found", "keyID", keyID)
		return nil
	}

	return privateKey
}

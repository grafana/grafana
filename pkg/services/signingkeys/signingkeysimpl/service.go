package signingkeysimpl

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"errors"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystore"
)

var _ signingkeys.Service = new(Service)

func ProvideEmbeddedSigningKeysService(dbStore db.DB, secretsService secrets.Service,
	remoteCache remotecache.CacheStorage,
) (*Service, error) {
	s := &Service{
		log:         log.New("auth.key_service"),
		store:       signingkeystore.NewSigningKeyStore(dbStore, secretsService),
		remoteCache: remoteCache,
	}

	return s, nil
}

// Service provides functionality for managing signing keys used to sign and verify JWT tokens for
// the OSS version of Grafana.
//
// The service is under active development and is not yet ready for production use.
type Service struct {
	log         log.Logger
	store       signingkeystore.SigningStore
	remoteCache remotecache.CacheStorage
}

// GetJWKS returns the JSON Web Key Set (JWKS) with all the keys that can be used to verify tokens (public keys)
func (s *Service) GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error) {
	jwks, err := s.store.GetJWKS(ctx)
	return jwks, err
}

// GetOrCreatePrivateKey returns the private key with the specified key ID. If the key does not exist, it will be
// created with the specified algorithm.
// The key will be automatically rotated at the beginning of each month. The previous key will be kept for 30 days.
func (s *Service) GetOrCreatePrivateKey(ctx context.Context,
	keyPrefix string, alg jose.SignatureAlgorithm) (string, crypto.Signer, error) {
	if alg != jose.ES256 {
		s.log.Error("Only ES256 is supported", "alg", alg)
		return "", nil, signingkeys.ErrKeyGenerationFailed.Errorf("Only ES256 is supported: %v", alg)
	}

	keyID := keyMonthScopedID(keyPrefix, alg)
	signer, err := s.store.GetPrivateKey(ctx, keyID)
	if err == nil {
		return keyID, signer, nil
	}
	s.log.Debug("Private key not found, generating new key", "keyID", keyID, "err", err)

	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		s.log.Error("Error generating private key", "err", err)
		return "", nil, signingkeys.ErrKeyGenerationFailed.Errorf("Error generating private key: %v", err)
	}

	expiry := time.Now().Add(30 * 24 * time.Hour)
	if signer, err = s.store.AddPrivateKey(ctx, keyID, alg, privateKey, &expiry, false); err != nil && !errors.Is(err, signingkeys.ErrSigningKeyAlreadyExists) {
		return "", nil, err
	}

	return keyID, signer, nil
}

func keyMonthScopedID(keyPrefix string, alg jose.SignatureAlgorithm) string {
	keyID := keyPrefix + "-" + time.Now().UTC().Format("2006-01") + "-" + strings.ToLower(string(alg))
	return keyID
}

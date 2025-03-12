package signingkeysimpl

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/signingkeys/signingkeystore"
)

var _ signingkeys.Service = new(Service)

func ProvideEmbeddedSigningKeysService(dbStore db.DB, secretsService secrets.Service,
	remoteCache remotecache.CacheStorage, routerRegister routing.RouteRegister,
) (*Service, error) {
	s := &Service{
		log:            log.New("auth.key_service"),
		store:          signingkeystore.NewSigningKeyStore(dbStore),
		secretsService: secretsService,
		remoteCache:    remoteCache,
		localCache:     localcache.New(1*time.Hour, 1*time.Hour),
	}

	s.registerAPIEndpoints(routerRegister)

	return s, nil
}

// Service provides functionality for managing signing keys used to sign and verify JWT tokens for
// the OSS version of Grafana.
//
// The service is under active development and is not yet ready for production use.
type Service struct {
	log            log.Logger
	store          signingkeystore.SigningStore
	secretsService secrets.Service
	remoteCache    remotecache.CacheStorage
	localCache     *localcache.CacheService
}

const (
	jwksCacheKey  = "signingkeys-jwks"
	jwksTTL       = 12 * time.Hour
	privateKeyTTL = 60 * time.Second
)

// GetJWKS returns the JSON Web Key Set (JWKS) with all the keys that can be used to verify tokens (public keys)
func (s *Service) GetJWKS(ctx context.Context) (jose.JSONWebKeySet, error) {
	// check cache for jwks
	keySet := jose.JSONWebKeySet{}
	if jwks, err := s.remoteCache.Get(ctx, jwksCacheKey); err == nil {
		if err := json.Unmarshal(jwks, &keySet); err == nil {
			return keySet, nil
		}
	}

	keys, err := s.store.List(ctx)
	if err != nil {
		return jose.JSONWebKeySet{}, err
	}

	jwks, err := s.buildJWKS(ctx, keys)
	if err != nil {
		return jwks, err
	}

	// cache jwks
	jwksBytes, err := json.Marshal(jwks)
	if err == nil {
		if err := s.remoteCache.Set(ctx, jwksCacheKey, jwksBytes, jwksTTL); err != nil {
			s.log.Warn("Failed to cache JWKS", "err", err)
		}
	}

	return jwks, err
}

func (s *Service) buildJWKS(ctx context.Context, keys []signingkeys.SigningKey) (jose.JSONWebKeySet, error) {
	var jwks jose.JSONWebKeySet
	for _, key := range keys {
		assertedKey, err := s.decodePrivateKey(ctx, key.PrivateKey)
		if err != nil {
			return jwks, err
		}

		jwks.Keys = append(jwks.Keys, jose.JSONWebKey{
			Key:       assertedKey.Public(),
			Algorithm: string(key.Alg),
			KeyID:     key.KeyID,
			Use:       "sig",
		})
	}
	return jwks, nil
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
	signer, err := s.getPrivateKey(ctx, keyID)
	if err == nil {
		return keyID, signer, nil
	}

	// we only want to create a new signing key if none exits for keyID
	if !errors.Is(err, signingkeys.ErrSigningKeyNotFound) {
		return "", nil, err
	}

	s.log.Debug("Private key not found, generating new key", "keyID", keyID, "err", err)

	signer, err = s.addPrivateKey(ctx, keyID, alg, false)
	if err != nil {
		return "", nil, err
	}

	return keyID, signer, nil
}

func (s *Service) getPrivateKey(ctx context.Context, keyID string) (crypto.Signer, error) {
	if key, ok := s.localCache.Get(keyID); ok {
		return key.(crypto.Signer), nil
	}

	key, err := s.store.Get(ctx, keyID)
	if err != nil {
		return nil, err
	}

	signer, err := s.decodePrivateKey(ctx, key.PrivateKey)
	if err != nil {
		return nil, err
	}

	s.localCache.Set(keyID, signer, privateKeyTTL)
	return signer, nil
}

func (s *Service) addPrivateKey(ctx context.Context, keyID string, alg jose.SignatureAlgorithm, force bool) (crypto.Signer, error) {
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		s.log.Error("Error generating private key", "err", err)
		return nil, signingkeys.ErrKeyGenerationFailed.Errorf("Error generating private key: %v", err)
	}

	encoded, err := s.encodePrivateKey(ctx, privateKey)
	if err != nil {
		s.log.Error("Error encoding private key", "err", err)
		return nil, err
	}

	now := time.Now()
	expiry := now.Add(30 * 24 * time.Hour)
	key, err := s.store.Add(ctx, &signingkeys.SigningKey{
		KeyID:      keyID,
		PrivateKey: string(encoded),
		ExpiresAt:  &expiry,
		Alg:        alg,
		AddedAt:    now,
	}, force)

	if err != nil && !errors.Is(err, signingkeys.ErrSigningKeyAlreadyExists) {
		return nil, err
	}

	signer, err := s.decodePrivateKey(ctx, key.PrivateKey)
	if err != nil {
		return nil, err
	}

	// invalidate local cache
	s.localCache.Delete(keyID)

	// invalidate cache
	if err := s.remoteCache.Delete(ctx, jwksCacheKey); err != nil {
		// not a critical error, key might not be in cache
		s.log.Debug("Failed to invalidate JWKS cache", "err", err)
	}

	return signer, nil
}

func (s *Service) encodePrivateKey(ctx context.Context, privateKey crypto.Signer) ([]byte, error) {
	// Encode private key to binary format
	pKeyBytes, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return nil, err
	}

	// Encode private key to PEM format
	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: pKeyBytes,
	})

	encrypted, err := s.secretsService.Encrypt(ctx, privateKeyPEM, secrets.WithoutScope())
	if err != nil {
		return nil, err
	}

	encoded := make([]byte, base64.RawStdEncoding.EncodedLen(len(encrypted)))
	base64.RawStdEncoding.Encode(encoded, encrypted)
	return encoded, nil
}

func (s *Service) decodePrivateKey(ctx context.Context, privateKey string) (crypto.Signer, error) {
	// Bail out if empty string since it'll cause a segfault in Decrypt
	if len(privateKey) == 0 {
		return nil, errors.New("private key is empty")
	}

	// Backwards compatibility with old base64 encoding
	// Can be removed in the future
	privateKey = strings.TrimRight(privateKey, "=")

	payload, err := base64.RawStdEncoding.DecodeString(privateKey)
	if err != nil {
		return nil, err
	}

	decrypted, err := s.secretsService.Decrypt(ctx, payload)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(decrypted)
	if block == nil {
		return nil, errors.New("failed to decode private key PEM")
	}

	if block.Type != "PRIVATE KEY" {
		return nil, errors.New("invalid block type")
	}

	parsedKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	assertedKey, ok := parsedKey.(crypto.Signer)
	if !ok {
		return nil, errors.New("failed to assert private key as crypto.Signer")
	}
	return assertedKey, nil
}

func keyMonthScopedID(keyPrefix string, alg jose.SignatureAlgorithm) string {
	keyID := keyPrefix + "-" + time.Now().UTC().Format("2006-01") + "-" + strings.ToLower(string(alg))
	return keyID
}

func (s *Service) registerAPIEndpoints(router routing.RouteRegister) {
	router.Group("/api/signing-keys", func(grouper routing.RouteRegister) {
		grouper.Get("/keys", s.exposeJWKS)
	})
}

// swagger:response jwksResponse
type RetrieveJWKSResponse struct {
	// in: body
	Body struct {
		Keys []jose.JSONWebKey `json:"keys"`
	}
}

// swagger:route GET /signing-keys/keys signing_keys retrieveJWKS
//
// # Get JSON Web Key Set (JWKS) with all the keys that can be used to verify tokens (public keys)
//
// Required permissions
// None
//
// Responses:
// 200: jwksResponse
// 500: internalServerError
func (s *Service) exposeJWKS(ctx *contextmodel.ReqContext) response.Response {
	jwks, err := s.GetJWKS(ctx.Req.Context())
	if err != nil {
		s.log.Error("Failed to get JWKS", "err", err)
		return response.Error(http.StatusInternalServerError, "Failed to get JWKS", err)
	}

	// set cache headers to 1 hour
	ctx.Resp.Header().Set("Cache-Control", "public, max-age=3600")

	return response.JSON(http.StatusOK, jwks)
}

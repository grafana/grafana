package jwt

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	jose "gopkg.in/square/go-jose.v2"
)

var ErrFailedToParsePemFile = errors.New("failed to parse pem-encoded file")
var ErrKeySetIsNotConfigured = errors.New("key set for jwt verification is not configured")
var ErrKeySetConfigurationAmbiguous = errors.New("key set configuration is ambiguous: you should set either key_file, jwk_set_file or jwk_set_url")
var ErrJWTSetURLMustHaveHTTPSScheme = errors.New("jwt_set_url must have https scheme")

type keySet interface {
	Key(ctx context.Context, kid string) ([]jose.JSONWebKey, error)
}

type keySetJWKS struct {
	jose.JSONWebKeySet
}

type keySetHTTP struct {
	url             string
	log             log.Logger
	client          *http.Client
	cache           *remotecache.RemoteCache
	cacheKey        string
	cacheExpiration time.Duration
}

func (s *AuthService) checkKeySetConfiguration() error {
	var count int
	if s.Cfg.JWTAuthKeyFile != "" {
		count++
	}
	if s.Cfg.JWTAuthJWKSetFile != "" {
		count++
	}
	if s.Cfg.JWTAuthJWKSetURL != "" {
		count++
	}

	// this only applies to key sets configured by the user
	if count > 1 {
		return ErrKeySetConfigurationAmbiguous
	}

	if s.Features.IsEnabled(featuremgmt.FlagJwtTokenGeneration) {
		count++
	}

	if count == 0 {
		return ErrKeySetIsNotConfigured
	}

	return nil
}

func (s *AuthService) initKeySet() error {
	if err := s.checkKeySetConfiguration(); err != nil {
		return err
	}

	if keyFilePath := s.Cfg.JWTAuthKeyFile; keyFilePath != "" {
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `fileName` comes from grafana configuration file
		file, err := os.Open(keyFilePath)
		if err != nil {
			return err
		}
		defer func() {
			if err := file.Close(); err != nil {
				s.log.Warn("Failed to close file", "path", keyFilePath, "err", err)
			}
		}()

		data, err := io.ReadAll(file)
		if err != nil {
			return err
		}
		block, _ := pem.Decode(data)
		if block == nil {
			return ErrFailedToParsePemFile
		}

		var key interface{}
		switch block.Type {
		case "PUBLIC KEY":
			if key, err = x509.ParsePKIXPublicKey(block.Bytes); err != nil {
				return err
			}
		case "PRIVATE KEY":
			if key, err = x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
				return err
			}
		case "RSA PUBLIC KEY":
			if key, err = x509.ParsePKCS1PublicKey(block.Bytes); err != nil {
				return err
			}
		case "RSA PRIVATE KEY":
			if key, err = x509.ParsePKCS1PrivateKey(block.Bytes); err != nil {
				return err
			}
		case "EC PRIVATE KEY":
			if key, err = x509.ParseECPrivateKey(block.Bytes); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unknown pem block type %q", block.Type)
		}

		s.keySets = append(s.keySets, keySetJWKS{
			jose.JSONWebKeySet{
				Keys: []jose.JSONWebKey{{Key: key}},
			},
		})
	} else if keyFilePath := s.Cfg.JWTAuthJWKSetFile; keyFilePath != "" {
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `fileName` comes from grafana configuration file
		file, err := os.Open(keyFilePath)
		if err != nil {
			return err
		}
		defer func() {
			if err := file.Close(); err != nil {
				s.log.Warn("Failed to close file", "path", keyFilePath, "err", err)
			}
		}()

		var jwks jose.JSONWebKeySet
		if err := json.NewDecoder(file).Decode(&jwks); err != nil {
			return err
		}

		s.keySets = append(s.keySets, keySetJWKS{jwks})
	} else if urlStr := s.Cfg.JWTAuthJWKSetURL; urlStr != "" {
		urlParsed, err := url.Parse(urlStr)
		if err != nil {
			return err
		}
		if urlParsed.Scheme != "https" {
			return ErrJWTSetURLMustHaveHTTPSScheme
		}
		s.keySets = append(s.keySets, &keySetHTTP{
			url:             urlStr,
			log:             s.log,
			client:          &http.Client{},
			cacheKey:        fmt.Sprintf("auth-jwt:jwk-%s", urlStr),
			cacheExpiration: s.Cfg.JWTAuthCacheTTL,
			cache:           s.RemoteCache,
		})
	}

	if s.Features.IsEnabled(featuremgmt.FlagJwtTokenGeneration) {
		s.initKeySetForGeneration(context.Background())
	}

	return nil
}

func (ks keySetJWKS) Key(ctx context.Context, keyID string) ([]jose.JSONWebKey, error) {
	return ks.JSONWebKeySet.Key(keyID), nil
}

func (ks *keySetHTTP) getJWKS(ctx context.Context) (keySetJWKS, error) {
	var jwks keySetJWKS

	if ks.cacheExpiration > 0 {
		if val, err := ks.cache.Get(ctx, ks.cacheKey); err == nil {
			err := json.Unmarshal(val.([]byte), &jwks)
			return jwks, err
		}
	}

	ks.log.Debug("Getting key set from endpoint", "url", ks.url)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ks.url, nil)
	if err != nil {
		return jwks, err
	}

	resp, err := ks.client.Do(req)
	if err != nil {
		return jwks, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			ks.log.Warn("Failed to close response body", "err", err)
		}
	}()

	var jsonBuf bytes.Buffer
	if err := json.NewDecoder(io.TeeReader(resp.Body, &jsonBuf)).Decode(&jwks); err != nil {
		return jwks, err
	}

	if ks.cacheExpiration > 0 {
		err = ks.cache.Set(ctx, ks.cacheKey, jsonBuf.Bytes(), ks.cacheExpiration)
	}
	return jwks, err
}

func (ks keySetHTTP) Key(ctx context.Context, kid string) ([]jose.JSONWebKey, error) {
	jwks, err := ks.getJWKS(ctx)
	if err != nil {
		return nil, err
	}
	return jwks.Key(ctx, kid)
}

func (s *AuthService) initKeySetForGeneration(ctx context.Context) error {
	set := jose.JSONWebKeySet{}
	privKey, err := s.getPrivateKey(ctx)
	if err != nil {
		return err
	}
	pubKey := privKey.Public()
	pubKey.KeyID = privKey.KeyID
	set.Keys = append(set.Keys, pubKey)
	s.keySets = append(s.keySets, keySetJWKS{
		JSONWebKeySet: set,
	})
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.SignatureAlgorithm(privKey.Algorithm), Key: privKey}, (&jose.SignerOptions{}).WithType("JWT"))
	if err != nil {
		return err
	}
	s.signer = signer
	return nil
}

func (s *AuthService) getPrivateKey(ctx context.Context) (privKey *jose.JSONWebKey, err error) {
	raw, ok, err := s.secretsKVStore.Get(ctx)
	if err != nil {
		return nil, err
	}

	if ok {
		if err = json.Unmarshal([]byte(raw), privKey); err != nil {
			s.log.Debug("Failed to unmarshal private key from KV store", "err", err)
		}
	}

	if privKey == nil {
		if privKey, err = generateJWK(); err != nil {
			return nil, err
		}
		keyJson, err := json.Marshal(privKey)
		if err != nil {
			return nil, err
		}
		if err = s.secretsKVStore.Set(ctx, string(keyJson)); err != nil {
			return nil, err
		}
	}

	return privKey, nil
}

func generateJWK() (privKey *jose.JSONWebKey, err error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	privKey = &jose.JSONWebKey{Key: key, KeyID: "", Algorithm: string(jose.RS512), Use: "sig"}
	thumb, err := privKey.Thumbprint(crypto.SHA256)
	if err != nil {
		return nil, err
	}
	privKey.KeyID = base64.RawURLEncoding.EncodeToString(thumb)
	return privKey, nil
}

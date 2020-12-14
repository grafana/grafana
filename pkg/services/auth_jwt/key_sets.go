package auth_jwt

import (
	"bytes"
	"context"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	jose "gopkg.in/square/go-jose.v2"
)

var ErrFailedToParsePemFile = errors.New("failed to parse pem-encoded file")
var ErrKeySetIsNotConfigured = errors.New("key set for jwt verification is not configured")
var ErrKeySetConfigurationAmbigous = errors.New("key set configuration is ambigous: you should set either key_file, jwk_set_file or jwk_set_url")

type keySet interface {
	Key(ctx context.Context, kid string) ([]jose.JSONWebKey, error)
}

type keySetJWKS struct {
	jose.JSONWebKeySet
}

type keySetHTTP struct {
	url             string
	client          *http.Client
	cache           *remotecache.RemoteCache
	cacheKey        string
	cacheExpiration time.Duration
}

func (s *JWTAuthService) checkKeySetConfiguration() error {
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

	if count == 0 {
		return ErrKeySetIsNotConfigured
	}

	if count > 1 {
		return ErrKeySetConfigurationAmbigous
	}

	return nil
}

func (s *JWTAuthService) initKeySet() error {
	if err := s.checkKeySetConfiguration(); err != nil {
		return err
	}

	if fileName := s.Cfg.JWTAuthKeyFile; fileName != "" {
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `fileName` comes from grafana configuration file
		file, err := os.Open(fileName)
		if err != nil {
			return err
		}

		data, err := ioutil.ReadAll(file)
		err1 := file.Close()
		if err != nil {
			return err
		}
		if err1 != nil {
			return err1
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

		s.keySet = keySetJWKS{
			jose.JSONWebKeySet{
				Keys: []jose.JSONWebKey{{Key: key}},
			},
		}
	} else if fileName := s.Cfg.JWTAuthJWKSetFile; fileName != "" {
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `fileName` comes from grafana configuration file
		file, err := os.Open(fileName)
		if err != nil {
			return err
		}
		var jwks jose.JSONWebKeySet
		err = json.NewDecoder(file).Decode(&jwks)
		err1 := file.Close()
		if err != nil {
			return err
		}
		if err1 != nil {
			return err1
		}

		s.keySet = keySetJWKS{jwks}
	} else if url := s.Cfg.JWTAuthJWKSetURL; url != "" {
		s.keySet = &keySetHTTP{
			url:             url,
			client:          &http.Client{},
			cacheKey:        fmt.Sprintf("auth-jwt:jwk-%s", url),
			cacheExpiration: s.Cfg.JWTAuthCacheTTL,
			cache:           s.RemoteCache,
		}
	}

	return nil
}

func (ks keySetJWKS) Key(ctx context.Context, keyID string) ([]jose.JSONWebKey, error) {
	return ks.JSONWebKeySet.Key(keyID), nil
}

func (ks *keySetHTTP) getJWKS(ctx context.Context) (keySetJWKS, error) {
	var jwks keySetJWKS

	if ks.cacheExpiration > 0 {
		if val, err := ks.cache.Get(ks.cacheKey); err == nil {
			err := json.Unmarshal(val.([]byte), &jwks)
			return jwks, err
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ks.url, nil)
	if err != nil {
		return jwks, err
	}

	resp, err := ks.client.Do(req)
	if err != nil {
		return jwks, err
	}

	var jsonBuf bytes.Buffer
	err = json.NewDecoder(io.TeeReader(resp.Body, &jsonBuf)).Decode(&jwks)
	err1 := resp.Body.Close()
	if err != nil {
		return jwks, err
	}
	if err1 != nil {
		return jwks, err1
	}

	if ks.cacheExpiration > 0 {
		err = ks.cache.Set(ks.cacheKey, jsonBuf.Bytes(), ks.cacheExpiration)
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

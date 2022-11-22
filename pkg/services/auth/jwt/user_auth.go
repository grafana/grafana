package jwt

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	jose "gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

const ServiceName = "UserAuthService"

func ProvideUserAuthService(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache) (*UserAuthService, error) {
	s := newUserAuthService(cfg, remoteCache)
	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newUserAuthService(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache) *UserAuthService {
	return &UserAuthService{
		Cfg: cfg,
		log: log.New("auth.jwt.user"),

		remoteCache: remoteCache,
	}
}

func (s *UserAuthService) init() error {
	if !s.Cfg.JWTAuthEnabled {
		return nil
	}

	if err := s.initClaimExpectations(); err != nil {
		return err
	}

	if err := s.initKeySet(); err != nil {
		return err
	}

	return nil
}

type UserAuthService struct {
	Cfg *setting.Cfg

	keySet keySet
	log    log.Logger

	additionalClaims map[string]interface{}
	expectedClaims   jwt.Expected

	remoteCache *remotecache.RemoteCache
}

func (s *UserAuthService) Verify(ctx context.Context, token string) (models.JWTClaims, error) {
	return Verify(ctx, s.keySet, s.expectedClaims, s.additionalClaims, token)
}

func (s *UserAuthService) initClaimExpectations() error {
	if err := json.Unmarshal([]byte(s.Cfg.JWTAuthExpectClaims), &s.additionalClaims); err != nil {
		return err
	}

	for key, value := range s.additionalClaims {
		switch key {
		case "iss":
			if stringValue, ok := value.(string); ok {
				s.expectedClaims.Issuer = stringValue
			} else {
				return fmt.Errorf("%q expectation has invalid type %T, string expected", key, value)
			}
			delete(s.additionalClaims, key)
		case "sub":
			if stringValue, ok := value.(string); ok {
				s.expectedClaims.Subject = stringValue
			} else {
				return fmt.Errorf("%q expectation has invalid type %T, string expected", key, value)
			}
			delete(s.additionalClaims, key)
		case "aud":
			switch value := value.(type) {
			case []interface{}:
				for _, val := range value {
					if v, ok := val.(string); ok {
						s.expectedClaims.Audience = append(s.expectedClaims.Audience, v)
					} else {
						return fmt.Errorf("%q expectation contains value with invalid type %T, string expected", key, val)
					}
				}
			case string:
				s.expectedClaims.Audience = []string{value}
			default:
				return fmt.Errorf("%q expectation has invalid type %T, array or string expected", key, value)
			}
			delete(s.additionalClaims, key)
		}
	}

	return nil
}

func (s *UserAuthService) checkKeySetConfiguration() error {
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

	if count > 1 {
		return ErrKeySetConfigurationAmbiguous
	}

	if count == 0 {
		return ErrKeySetIsNotConfigured
	}

	return nil
}

func (s *UserAuthService) initKeySet() error {
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

		s.keySet = keySetJWKS{
			jose.JSONWebKeySet{
				Keys: []jose.JSONWebKey{{Key: key}},
			},
		}
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

		s.keySet = keySetJWKS{jwks}
	} else if urlStr := s.Cfg.JWTAuthJWKSetURL; urlStr != "" {
		urlParsed, err := url.Parse(urlStr)
		if err != nil {
			return err
		}
		if urlParsed.Scheme != "https" {
			return ErrJWTSetURLMustHaveHTTPSScheme
		}
		s.keySet = &keySetHTTP{
			url:             urlStr,
			log:             s.log,
			client:          &http.Client{},
			cacheKey:        fmt.Sprintf("auth-jwt:jwk-%s", urlStr),
			cacheExpiration: s.Cfg.JWTAuthCacheTTL,
			cache:           s.remoteCache,
		}
	}

	return nil
}

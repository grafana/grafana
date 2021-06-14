package jwt

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/square/go-jose.v2/jwt"
)

const ServiceName = "AuthService"
const OidcWellKnowConfigUri = "/.well-known/openid-configuration"

func init() {
	registry.Register(&registry.Descriptor{
		Name:         ServiceName,
		Instance:     &AuthService{},
		InitPriority: registry.Medium,
	})
}

type AuthService struct {
	Cfg         *setting.Cfg             `inject:""`
	RemoteCache *remotecache.RemoteCache `inject:""`

	keySet           keySet
	log              log.Logger
	expect           map[string]interface{}
	expectRegistered jwt.Expected
}

func (s *AuthService) Init() error {
	if !s.Cfg.JWTAuthEnabled {
		return nil
	}

	s.log = log.New("auth.jwt")

	if err := s.initClaimExpectations(); err != nil {
		return err
	}
	if s.Cfg.JWTAuthKeyFile == "" && s.Cfg.JWTAuthJWKSetFile == "" && s.Cfg.JWTAuthJWKSetURL == "" {
		if err := s.detectJWKSUri(); err != nil {
			s.log.Debug("JWKS uri not detected due to", "err", err)
		}
	}
	if err := s.initKeySet(); err != nil {
		return err
	}

	return nil
}

// Auto configure JWKS Url following OIDC standards if the issuer is trusted
// This can't work if you don't trust any issuers in JWTAuthExpectClaims
func (s *AuthService) detectJWKSUri() error {
	if s.expectRegistered.Issuer != "" {
		oidcConfigURL := strings.TrimSuffix(s.expect["iss"].(string), "/") + OidcWellKnowConfigUri
		var httpClient = &http.Client{Timeout: 10 * time.Second}
		r, err := httpClient.Get(oidcConfigURL)
		if err != nil {
			return err
		}
		defer func() {
			if err := r.Body.Close(); err != nil {
				s.log.Warn("Failed to close response body", "err", err)
			}
		}()

		var oidcConfig map[string]interface{}
		err = json.NewDecoder(r.Body).Decode(&oidcConfig)
		if err != nil {
			return err
		}
		s.Cfg.JWTAuthJWKSetURL = oidcConfig["jwks_uri"].(string)
		s.log.Debug("JWKS URL configured with trusted issuer")
	}

	return nil
}

func (s *AuthService) Verify(ctx context.Context, strToken string) (models.JWTClaims, error) {
	s.log.Debug("Parsing JSON Web Token")

	token, err := jwt.ParseSigned(strToken)
	if err != nil {
		return nil, err
	}

	keys, err := s.keySet.Key(ctx, token.Headers[0].KeyID)
	if err != nil {
		return nil, err
	}
	if len(keys) == 0 {
		return nil, errors.New("no keys found")
	}

	s.log.Debug("Trying to verify JSON Web Token using a key")

	var claims models.JWTClaims
	for _, key := range keys {
		if err = token.Claims(key, &claims); err == nil {
			break
		}
	}
	if err != nil {
		return nil, err
	}

	s.log.Debug("Validating JSON Web Token claims")

	if err = s.validateClaims(claims); err != nil {
		return nil, err
	}

	return claims, nil
}

package jwt

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/setting"
)

const ServiceName = "AuthService"

func ProvideService(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache) (*AuthService, error) {
	s := newService(cfg, remoteCache)
	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newService(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache) *AuthService {
	return &AuthService{
		Cfg:         cfg,
		RemoteCache: remoteCache,
		log:         log.New("auth.jwt"),
	}
}

func (s *AuthService) init() error {
	if !s.Cfg.JWTAuth.Enabled {
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

type AuthService struct {
	Cfg         *setting.Cfg
	RemoteCache *remotecache.RemoteCache

	keySet           keySet
	log              log.Logger
	expect           map[string]any
	expectRegistered jwt.Expected
}

// Sanitize JWT base64 strings to remove paddings everywhere
func sanitizeJWT(jwtToken string) string {
	// JWT can be compact, JSON flatened or JSON general
	// In every cases, parts are base64 strings without padding
	// The padding char (=) should never interfer with data
	return strings.ReplaceAll(jwtToken, string(base64.StdPadding), "")
}

func (s *AuthService) Verify(ctx context.Context, strToken string) (map[string]any, error) {
	s.log.Debug("Parsing JSON Web Token")

	strToken = sanitizeJWT(strToken)
	token, err := jwt.ParseSigned(strToken, []jose.SignatureAlgorithm{jose.ES256})
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

	var claims map[string]any
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

// HasSubClaim checks if the provided JWT token contains a non-empty "sub" claim.
// Returns true if it contains, otherwise returns false.
func HasSubClaim(jwtToken string) bool {
	parsed, err := jwt.ParseSigned(sanitizeJWT(jwtToken), []jose.SignatureAlgorithm{jose.ES256})
	if err != nil {
		return false
	}

	var claims jwt.Claims
	if err := parsed.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return false
	}

	return claims.Subject != ""
}

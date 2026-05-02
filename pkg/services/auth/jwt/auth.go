package jwt

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"sync"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

const ServiceName = "AuthService"

func ProvideService(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache, ssoSettings ssosettings.Service) (*AuthService, error) {
	s := newService(cfg, remoteCache)

	ssoSettings.RegisterReloadable(social.JWTProviderName, s)

	settings, err := ssoSettings.GetForProvider(context.Background(), social.JWTProviderName)
	if err != nil {
		s.log.Error("failed to load JWT settings from SSO store, falling back to config file", "error", err)
		if initErr := s.init(); initErr != nil {
			s.log.Error("failed to apply JWT config file settings", "error", initErr)
		}
		return s, nil
	}

	if err := s.Reload(context.Background(), *settings); err != nil {
		s.log.Error("failed to apply JWT settings", "error", err)
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

type AuthService struct {
	Cfg         *setting.Cfg
	RemoteCache *remotecache.RemoteCache
	log         log.Logger

	// mu protects all fields below. Reload swaps the snapshot under Lock;
	// Verify takes RLock to copy the pointers it needs and drops the lock
	// before doing any I/O.
	mu               sync.RWMutex
	settings         setting.AuthJWTSettings
	keySet           keySet
	expect           map[string]any
	expectRegistered jwt.Expected
}

// init applies the file-config (cfg.JWTAuth) as the current effective state.
// Used as a fallback when no SSO settings store is available.
func (s *AuthService) init() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.apply(s.Cfg.JWTAuth)
}

// apply installs a parsed settings struct as the current state.
// Callers must hold s.mu for writing.
func (s *AuthService) apply(next setting.AuthJWTSettings) error {
	s.settings = next
	s.keySet = nil
	s.expect = nil
	s.expectRegistered = jwt.Expected{}

	if !next.Enabled {
		return nil
	}
	if err := s.initClaimExpectations(); err != nil {
		return err
	}
	return s.initKeySet()
}

// Settings returns a snapshot of the current JWT auth settings.
// The returned struct is safe to use independently of subsequent reloads:
// the OrgMapping slice is copied so callers can't mutate the live state.
func (s *AuthService) Settings() setting.AuthJWTSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := s.settings
	if len(s.settings.OrgMapping) > 0 {
		out.OrgMapping = append([]string(nil), s.settings.OrgMapping...)
	}
	return out
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

	s.mu.RLock()
	keySet := s.keySet
	expect := s.expect
	expectRegistered := s.expectRegistered
	s.mu.RUnlock()

	if keySet == nil {
		return nil, errors.New("jwt auth not configured")
	}

	strToken = sanitizeJWT(strToken)
	token, err := jwt.ParseSigned(strToken, []jose.SignatureAlgorithm{jose.EdDSA, jose.HS256, jose.HS384,
		jose.HS512, jose.RS512, jose.RS256, jose.ES256, jose.ES384, jose.ES512, jose.PS256, jose.PS384, jose.PS512})
	if err != nil {
		return nil, err
	}

	keys, err := keySet.Key(ctx, token.Headers[0].KeyID)
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

	if err = validateClaims(claims, expect, expectRegistered); err != nil {
		return nil, err
	}

	return claims, nil
}

// HasSubClaim checks if the provided JWT token contains a non-empty "sub" claim.
// Returns true if it contains, otherwise returns false.
func HasSubClaim(jwtToken string) bool {
	parsed, err := jwt.ParseSigned(sanitizeJWT(jwtToken), []jose.SignatureAlgorithm{jose.EdDSA, jose.HS256, jose.HS384,
		jose.HS512, jose.RS512, jose.RS256, jose.ES256, jose.ES384, jose.ES512, jose.PS256, jose.PS384, jose.PS512})
	if err != nil {
		return false
	}

	var claims jwt.Claims
	if err := parsed.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return false
	}

	return claims.Subject != ""
}

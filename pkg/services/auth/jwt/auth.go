package jwt

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

const ServiceName = "AuthService"

func ProvideService(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache, features *featuremgmt.FeatureManager) (*AuthService, error) {
	s := newService(cfg, remoteCache, features)
	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newService(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache, features *featuremgmt.FeatureManager) *AuthService {
	return &AuthService{
		Cfg:         cfg,
		Features:    features,
		RemoteCache: remoteCache,
		log:         log.New("auth.jwt"),

		// TODO: make this configurable after alpha
		jwtExpiration: 1 * time.Minute,
	}
}

func (s *AuthService) init() error {
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

type AuthService struct {
	Cfg         *setting.Cfg
	Features    *featuremgmt.FeatureManager
	RemoteCache *remotecache.RemoteCache

	keySets          []keySet
	log              log.Logger
	expect           map[string]interface{}
	expectRegistered jwt.Expected

	// Used by feature FlagTemporaryJWTAuth
	signer        jose.Signer
	jwtExpiration time.Duration
}

// Sanitize JWT base64 strings to remove paddings everywhere
func sanitizeJWT(jwtToken string) string {
	// JWT can be compact, JSON flatened or JSON general
	// In every cases, parts are base64 strings without padding
	// The padding char (=) should never interfer with data
	return strings.ReplaceAll(jwtToken, string(base64.StdPadding), "")
}

func (s *AuthService) Verify(ctx context.Context, strToken string) (models.JWTClaims, error) {
	s.log.Debug("Parsing JSON Web Token")

	strToken = sanitizeJWT(strToken)
	token, err := jwt.ParseSigned(strToken)
	if err != nil {
		return nil, err
	}

	keys, err := s.getKeys(ctx, token.Headers[0].KeyID)
	if err != nil {
		return nil, err
	}
	if len(keys) == 0 {
		return nil, errors.New("key ID not found in configured key sets")
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

func (s *AuthService) Generate(subject, audience string) (string, error) {
	if s.signer == nil {
		return "", errors.New("JWT generation is disabled")
	}

	claims := jwt.Claims{
		Subject:   subject,
		Issuer:    s.Cfg.AppURL,
		Audience:  jwt.Audience{audience},
		NotBefore: jwt.NewNumericDate(time.Now()),
		Expiry:    jwt.NewNumericDate(time.Now().Add(s.jwtExpiration)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}

	return jwt.Signed(s.signer).Claims(claims).CompactSerialize()
}

// getKeys finds the keys for the given key ID in all key sets
func (s *AuthService) getKeys(ctx context.Context, keyID string) ([]jose.JSONWebKey, error) {
	var (
		wg   sync.WaitGroup
		err  error
		keys []jose.JSONWebKey
		mu   sync.Mutex
	)

	for _, ks := range s.keySets {
		wg.Add(1)
		go func(ks keySet) {
			defer wg.Done()
			k, e := ks.Key(ctx, keyID)
			mu.Lock()
			if len(keys) == 0 {
				keys = k
				err = e
			}
			mu.Unlock()
		}(ks)
	}

	wg.Wait()

	return keys, err
}

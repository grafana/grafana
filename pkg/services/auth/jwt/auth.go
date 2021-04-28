package jwt

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/square/go-jose.v2/jwt"
)

const ServiceName = "AuthService"

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
	if err := s.initKeySet(); err != nil {
		return err
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

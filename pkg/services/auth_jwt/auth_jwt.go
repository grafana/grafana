package auth_jwt

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

const ServiceName = "JWTAuthService"

func init() {
	registry.Register(&registry.Descriptor{
		Name:         ServiceName,
		Instance:     &JWTAuthService{},
		InitPriority: registry.Medium,
	})
}

type JWTAuthService struct {
	Cfg         *setting.Cfg             `inject:""`
	RemoteCache *remotecache.RemoteCache `inject:""`

	keySet           keySet
	log              log.Logger
	expect           map[string]interface{}
	expectRegistered jwt.Expected
}

func (s *JWTAuthService) Init() error {
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

func (s *JWTAuthService) Verify(ctx context.Context, strToken string) (models.JWTClaims, error) {
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

	var claims models.JWTClaims
	for _, key := range keys {
		if err = token.Claims(key, &claims); err == nil {
			break
		}
	}
	if err != nil {
		return nil, err
	}

	if err = s.validateClaims(claims); err != nil {
		return nil, err
	}

	return claims, nil
}

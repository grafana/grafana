package idimpl

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	cachePrefix = "id-token"
	tokenTTL    = 1 * time.Hour
	cacheTTL    = 58 * time.Minute
)

var _ auth.IDService = (*Service)(nil)

func ProvideService(cfg *setting.Cfg, signer auth.IDSigner, cache remotecache.CacheStorage) *Service {
	return &Service{cfg, log.New("id-service"), signer, cache}
}

type Service struct {
	cfg    *setting.Cfg
	logger log.Logger
	signer auth.IDSigner
	cache  remotecache.CacheStorage
}

func (s *Service) SignIdentity(ctx context.Context, id identity.Requester) (string, error) {
	namespace, identifier := id.GetNamespacedID()

	cacheKey := prefixCacheKey(id.GetCacheKey())
	cachedToken, err := s.cache.Get(ctx, cacheKey)
	if err == nil {
		s.logger.Debug("Cached token found", "namespace", namespace, "id", identifier)
		return string(cachedToken), nil
	}

	s.logger.Debug("Sign new id token", "namespace", namespace, "id", identifier)

	now := time.Now()

	token, err := s.signer.SignIDToken(ctx, &auth.IDClaims{
		Claims: jwt.Claims{
			ID:       identifier,
			Issuer:   s.cfg.AppURL,
			Audience: jwt.Audience{strconv.FormatInt(id.GetOrgID(), 10)},
			Subject:  fmt.Sprintf("%s:%s", namespace, identifier),
			Expiry:   jwt.NewNumericDate(now.Add(tokenTTL)),
			IssuedAt: jwt.NewNumericDate(now),
		},
	})

	if err != nil {
		return "", err
	}

	if err := s.cache.Set(ctx, cacheKey, []byte(token), cacheTTL); err != nil {
		s.logger.Error("failed to set cache", "error", err)
	}

	return token, nil
}

func prefixCacheKey(key string) string {
	return fmt.Sprintf("%s-%s", cachePrefix, key)
}

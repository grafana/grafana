package idimpl

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	cachePrefix = "id-token"
	tokenTTL    = 10 * time.Minute
	cacheLeeway = 30 * time.Second
)

var _ auth.IDService = (*Service)(nil)

func ProvideService(
	cfg *setting.Cfg, signer auth.IDSigner, cache remotecache.CacheStorage,
	features featuremgmt.FeatureToggles, authnService authn.Service,
	authInfoService login.AuthInfoService, reg prometheus.Registerer,
) *Service {
	s := &Service{
		cfg: cfg, logger: log.New("id-service"),
		signer: signer, cache: cache,
		authInfoService: authInfoService, metrics: newMetrics(reg),
	}

	if features.IsEnabledGlobally(featuremgmt.FlagIdForwarding) {
		authnService.RegisterPostAuthHook(s.hook, 140)
	}

	return s
}

type Service struct {
	cfg             *setting.Cfg
	logger          log.Logger
	signer          auth.IDSigner
	cache           remotecache.CacheStorage
	authInfoService login.AuthInfoService
	si              singleflight.Group
	metrics         *metrics
}

func (s *Service) SignIdentity(ctx context.Context, id identity.Requester) (string, error) {
	defer func(t time.Time) {
		s.metrics.tokenSigningDurationHistogram.Observe(time.Since(t).Seconds())
	}(time.Now())

	cacheKey := prefixCacheKey(id.GetCacheKey())

	result, err, _ := s.si.Do(cacheKey, func() (interface{}, error) {
		namespace, identifier := id.GetNamespacedID()

		cachedToken, err := s.cache.Get(ctx, cacheKey)
		if err == nil {
			s.metrics.tokenSigningFromCacheCounter.Inc()
			s.logger.FromContext(ctx).Debug("Cached token found", "namespace", namespace, "id", identifier)
			return string(cachedToken), nil
		}

		s.metrics.tokenSigningCounter.Inc()
		s.logger.FromContext(ctx).Debug("Sign new id token", "namespace", namespace, "id", identifier)

		now := time.Now()
		claims := &auth.IDClaims{
			Claims: jwt.Claims{
				Issuer:   s.cfg.AppURL,
				Audience: getAudience(id.GetOrgID()),
				Subject:  getSubject(namespace, identifier),
				Expiry:   jwt.NewNumericDate(now.Add(tokenTTL)),
				IssuedAt: jwt.NewNumericDate(now),
			},
		}

		if identity.IsNamespace(namespace, identity.NamespaceUser) {
			if err := s.setUserClaims(ctx, identifier, claims); err != nil {
				return "", err
			}
		}

		token, err := s.signer.SignIDToken(ctx, claims)
		if err != nil {
			s.metrics.failedTokenSigningCounter.Inc()
			return "", err
		}

		parsed, err := jwt.ParseSigned(token)
		if err != nil {
			s.metrics.failedTokenSigningCounter.Inc()
			return "", err
		}

		extracted := auth.IDClaims{}
		// We don't need to verify the signature here, we are only intrested in checking
		// when the token expires.
		if err := parsed.UnsafeClaimsWithoutVerification(&extracted); err != nil {
			s.metrics.failedTokenSigningCounter.Inc()
			return "", err
		}

		expires := time.Until(extracted.Expiry.Time())
		if err := s.cache.Set(ctx, cacheKey, []byte(token), expires-cacheLeeway); err != nil {
			s.logger.FromContext(ctx).Error("Failed to add id token to cache", "error", err)
		}

		return token, nil
	})

	if err != nil {
		return "", err
	}

	return result.(string), nil
}

func (s *Service) setUserClaims(ctx context.Context, identifier string, claims *auth.IDClaims) error {
	id, err := strconv.ParseInt(identifier, 10, 64)
	if err != nil {
		return err
	}

	if id == 0 {
		return nil
	}

	info, err := s.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: id})
	if err != nil {
		// we ignore errors when a user don't have external user auth
		if !errors.Is(err, user.ErrUserNotFound) {
			s.logger.FromContext(ctx).Error("Failed to fetch auth info", "userId", id, "error", err)
		}

		return nil
	}

	claims.AuthenticatedBy = info.AuthModule

	return nil
}

func (s *Service) hook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	// FIXME(kalleep): we should probably lazy load this
	token, err := s.SignIdentity(ctx, identity)
	if err != nil {
		namespace, id := identity.GetNamespacedID()
		s.logger.FromContext(ctx).Error("Failed to sign id token", "err", err, "namespace", namespace, "id", id)
		// for now don't return error so we don't break authentication from this hook
		return nil
	}

	identity.IDToken = token
	return nil
}

func getAudience(orgID int64) jwt.Audience {
	return jwt.Audience{fmt.Sprintf("org:%d", orgID)}
}

func getSubject(namespace, identifier string) string {
	return fmt.Sprintf("%s:%s", namespace, identifier)
}

func prefixCacheKey(key string) string {
	return fmt.Sprintf("%s-%s", cachePrefix, key)
}

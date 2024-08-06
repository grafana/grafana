package idimpl

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	reg prometheus.Registerer,
) *Service {
	s := &Service{
		cfg: cfg, logger: log.New("id-service"),
		signer: signer, cache: cache,
		metrics:  newMetrics(reg),
		nsMapper: request.GetNamespaceMapper(cfg),
	}

	if features.IsEnabledGlobally(featuremgmt.FlagIdForwarding) {
		authnService.RegisterPostAuthHook(s.hook, 140)
	}

	return s
}

type Service struct {
	cfg      *setting.Cfg
	logger   log.Logger
	signer   auth.IDSigner
	cache    remotecache.CacheStorage
	si       singleflight.Group
	metrics  *metrics
	nsMapper request.NamespaceMapper
}

func (s *Service) SignIdentity(ctx context.Context, id identity.Requester) (string, *authnlib.Claims[authnlib.IDTokenClaims], error) {
	defer func(t time.Time) {
		s.metrics.tokenSigningDurationHistogram.Observe(time.Since(t).Seconds())
	}(time.Now())

	cacheKey := prefixCacheKey(id.GetCacheKey())

	type resultType struct {
		token    string
		idClaims *auth.IDClaims
	}
	result, err, _ := s.si.Do(cacheKey, func() (any, error) {
		namespace, identifier := id.GetTypedID()

		cachedToken, err := s.cache.Get(ctx, cacheKey)
		if err == nil {
			s.metrics.tokenSigningFromCacheCounter.Inc()
			s.logger.FromContext(ctx).Debug("Cached token found", "namespace", namespace, "id", identifier)

			tokenClaims, err := s.extractTokenClaims(string(cachedToken))
			if err != nil {
				return resultType{}, err
			}
			return resultType{token: string(cachedToken), idClaims: tokenClaims}, nil
		}

		s.metrics.tokenSigningCounter.Inc()
		s.logger.FromContext(ctx).Debug("Sign new id token", "namespace", namespace, "id", identifier)

		now := time.Now()
		claims := &auth.IDClaims{
			Claims: &jwt.Claims{
				Issuer:   s.cfg.AppURL,
				Audience: getAudience(id.GetOrgID()),
				Subject:  getSubject(namespace.String(), identifier),
				Expiry:   jwt.NewNumericDate(now.Add(tokenTTL)),
				IssuedAt: jwt.NewNumericDate(now),
			},
			Rest: authnlib.IDTokenClaims{
				Namespace: s.nsMapper(id.GetOrgID()),
			},
		}

		if identity.IsIdentityType(namespace, identity.TypeUser) {
			claims.Rest.Email = id.GetEmail()
			claims.Rest.EmailVerified = id.IsEmailVerified()
			claims.Rest.AuthenticatedBy = id.GetAuthenticatedBy()
			claims.Rest.Username = id.GetLogin()
			claims.Rest.UID = id.GetUID()
			claims.Rest.DisplayName = id.GetDisplayName()
		}

		token, err := s.signer.SignIDToken(ctx, claims)
		if err != nil {
			s.metrics.failedTokenSigningCounter.Inc()
			return resultType{}, nil
		}

		extracted, err := s.extractTokenClaims(token)
		if err != nil {
			return resultType{}, err
		}

		expires := time.Until(extracted.Expiry.Time())
		if err := s.cache.Set(ctx, cacheKey, []byte(token), expires-cacheLeeway); err != nil {
			s.logger.FromContext(ctx).Error("Failed to add id token to cache", "error", err)
		}

		return resultType{token: token, idClaims: claims}, nil
	})

	if err != nil {
		return "", nil, err
	}

	return result.(resultType).token, result.(resultType).idClaims, nil
}

func (s *Service) RemoveIDToken(ctx context.Context, id identity.Requester) error {
	return s.cache.Delete(ctx, prefixCacheKey(id.GetCacheKey()))
}

func (s *Service) hook(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	// FIXME(kalleep): we should probably lazy load this
	token, claims, err := s.SignIdentity(ctx, identity)
	if err != nil {
		if shouldLogErr(err) {
			namespace, id := identity.GetTypedID()
			s.logger.FromContext(ctx).Error("Failed to sign id token", "err", err, "namespace", namespace, "id", id)
		}
		// for now don't return error so we don't break authentication from this hook
		return nil
	}

	identity.IDToken = token
	identity.IDTokenClaims = claims
	return nil
}

func (s *Service) extractTokenClaims(token string) (*authnlib.Claims[authnlib.IDTokenClaims], error) {
	parsed, err := jwt.ParseSigned(token)
	if err != nil {
		s.metrics.failedTokenSigningCounter.Inc()
		return nil, err
	}

	extracted := authnlib.Claims[authnlib.IDTokenClaims]{}
	// We don't need to verify the signature here, we are only interested in checking
	// when the token expires.
	if err := parsed.UnsafeClaimsWithoutVerification(&extracted); err != nil {
		s.metrics.failedTokenSigningCounter.Inc()
		return nil, err
	}

	return &extracted, nil
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

func shouldLogErr(err error) bool {
	return !errors.Is(err, context.Canceled)
}

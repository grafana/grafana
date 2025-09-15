package idimpl

import (
	"context"
	"errors"
	"fmt"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/singleflight"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	cachePrefix = "id-token"
	tokenTTL    = 10 * time.Minute
	cacheLeeway = 30 * time.Second
)

var _ auth.IDService = (*Service)(nil)

func ProvideService(
	cfg *setting.Cfg, signer auth.IDSigner,
	cache remotecache.CacheStorage, authnService authn.Service,
	reg prometheus.Registerer, tracer trace.Tracer,
) *Service {
	s := &Service{
		cfg: cfg, logger: log.New("id-service"),
		signer: signer, cache: cache,
		metrics:  newMetrics(reg),
		nsMapper: request.GetNamespaceMapper(cfg),
		tracer:   tracer,
	}

	authnService.RegisterPostAuthHook(s.SyncIDToken, 140)

	return s
}

type Service struct {
	cfg      *setting.Cfg
	logger   log.Logger
	signer   auth.IDSigner
	cache    remotecache.CacheStorage
	si       singleflight.Group
	metrics  *metrics
	tracer   trace.Tracer
	nsMapper request.NamespaceMapper
}

func (s *Service) SignIdentity(ctx context.Context, id identity.Requester) (string, *authnlib.Claims[authnlib.IDTokenClaims], error) {
	ctx, span := s.tracer.Start(ctx, "user.sync.SignIdentity")
	defer span.End()

	defer func(t time.Time) {
		s.metrics.tokenSigningDurationHistogram.Observe(time.Since(t).Seconds())
	}(time.Now())

	cacheKey := getCacheKey(id)

	type resultType struct {
		token    string
		idClaims *auth.IDClaims
	}
	result, err, _ := s.si.Do(cacheKey, func() (any, error) {
		cachedToken, err := s.cache.Get(ctx, cacheKey)
		if err == nil {
			s.metrics.tokenSigningFromCacheCounter.Inc()
			s.logger.FromContext(ctx).Debug("Cached token found", "id", id.GetID())

			tokenClaims, err := s.extractTokenClaims(string(cachedToken))
			if err != nil {
				return resultType{}, err
			}
			return resultType{token: string(cachedToken), idClaims: tokenClaims}, nil
		}

		s.metrics.tokenSigningCounter.Inc()
		s.logger.FromContext(ctx).Debug("Sign new id token", "id", id.GetID())

		now := time.Now()
		idClaims := &auth.IDClaims{
			Claims: jwt.Claims{
				Issuer:   s.cfg.AppURL,
				Audience: getAudience(id.GetOrgID()),
				Subject:  id.GetID(),
				Expiry:   jwt.NewNumericDate(now.Add(tokenTTL)),
				IssuedAt: jwt.NewNumericDate(now),
			},
			Rest: authnlib.IDTokenClaims{
				Namespace:  s.nsMapper(id.GetOrgID()),
				Identifier: id.GetRawIdentifier(),
				Type:       id.GetIdentityType(),
			},
		}

		if id.IsIdentityType(claims.TypeUser) {
			idClaims.Rest.Email = id.GetEmail()
			idClaims.Rest.EmailVerified = id.GetEmailVerified()
			idClaims.Rest.AuthenticatedBy = id.GetAuthenticatedBy()
			idClaims.Rest.Username = id.GetLogin()
			idClaims.Rest.DisplayName = id.GetName()
		}

		if id.GetOrgRole().IsValid() {
			idClaims.Rest.Role = string(id.GetOrgRole())
		}

		token, err := s.signer.SignIDToken(ctx, idClaims)
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

		return resultType{token: token, idClaims: idClaims}, nil
	})

	if err != nil {
		return "", nil, err
	}

	return result.(resultType).token, result.(resultType).idClaims, nil
}

func (s *Service) RemoveIDToken(ctx context.Context, id identity.Requester) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.RemoveIDToken")
	defer span.End()

	return s.cache.Delete(ctx, getCacheKey(id))
}

func (s *Service) SyncIDToken(ctx context.Context, identity *authn.Identity, _ *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "user.sync.SyncIDToken")
	defer span.End()
	// FIXME(kalleep): we should probably lazy load this
	token, idClaims, err := s.SignIdentity(ctx, identity)
	if err != nil {
		if shouldLogErr(err) {
			s.logger.FromContext(ctx).Error("Failed to sign id token", "err", err, "id", identity.GetID())
		}
		// for now don't return error so we don't break authentication from this hook
		return nil
	}

	identity.IDToken = token
	identity.IDTokenClaims = idClaims
	return nil
}

func (s *Service) extractTokenClaims(token string) (*authnlib.Claims[authnlib.IDTokenClaims], error) {
	parsed, err := jwt.ParseSigned(token, []jose.SignatureAlgorithm{jose.ES256})
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

func getCacheKey(ident identity.Requester) string {
	return cachePrefix + ident.GetCacheKey() + string(ident.GetOrgRole())
}

func shouldLogErr(err error) bool {
	return !errors.Is(err, context.Canceled)
}

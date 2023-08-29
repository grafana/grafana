package idsigner

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/auth/assertid"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/web"
)

var _ assertid.Service = &Service{}

const cacheKeyPrefix = "assertid"

// Service implements the AssertID service.
type Service struct {
	logger            log.Logger
	remoteCache       remotecache.CacheStorage
	signingKeyService signingkeys.Service
	signer            jose.Signer
}

type idAssertions struct {
	Teams     []string `json:"teams"`
	IPAddress string   `json:"ip_address"`
}

// ProvideIDSigningService returns a new instance of the AssertID service.
func ProvideIDSigningService(remoteCache remotecache.CacheStorage,
	signingKeyService signingkeys.Service) *Service {
	key := signingKeyService.GetServerPrivateKey() // FIXME: replace with signing specific key

	service := &Service{
		logger:            log.New("auth.assertid"),
		remoteCache:       remoteCache,
		signer:            nil,
		signingKeyService: signingKeyService,
	}
	// Create a new JWT signer using the signing key.
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, nil)
	if err == nil {
		service.signer = signer
	} else {
		service.logger.Error("Unable to create signer", "error", err)
	}

	return service
}

// ActiveUserAssertion returns the active user assertion.
func (s *Service) ActiveUserAssertion(ctx context.Context, id identity.Requester, req *http.Request) (string, error) {
	if s.signer == nil {
		return "", fmt.Errorf("signer unavailable")
	}

	cacheKey, err := id.GetCacheKey()
	if err == nil {
		val, err := s.remoteCache.Get(ctx, fmt.Sprintf("%s-%s", cacheKeyPrefix, cacheKey))
		if err == nil {
			return string(val), nil
		}
	} else {
		return "", err
	}

	addr := web.RemoteAddr(req)
	ip, err := network.GetIPFromAddress(addr)
	if err != nil {
		s.logger.Debug("failed to parse ip from address", "addr", addr)
	}

	clientIPStr := ip.String()
	if len(ip) == 0 {
		clientIPStr = ""
	}

	namespace, identifier := id.GetNamespacedID()
	// Set the JWT claims.
	claims := jwt.Claims{
		Issuer:   fmt.Sprintf("%d", id.GetOrgID()),
		Subject:  fmt.Sprintf("%s:%s", namespace, identifier),
		Audience: jwt.Audience{"Grafana"},
		Expiry:   jwt.NewNumericDate(time.Now().Add(time.Minute * 5)),
		IssuedAt: jwt.NewNumericDate(time.Now()),
		ID:       identifier,
	}

	assertions := &idAssertions{
		Teams:     []string{"team1", "team2"},
		IPAddress: clientIPStr,
	}

	// Create a new JWT builder.
	builder := jwt.Signed(s.signer).Claims(claims).Claims(assertions)

	// Build the JWT.
	token, err := builder.CompactSerialize()
	if err != nil {
		return "", err
	}

	if err := s.remoteCache.Set(ctx,
		fmt.Sprintf("%s-%s", cacheKeyPrefix, cacheKey),
		[]byte(token), time.Minute*4); err != nil {
		s.logger.Error("failed to set cache", "error", err)
	}

	return token, nil
}

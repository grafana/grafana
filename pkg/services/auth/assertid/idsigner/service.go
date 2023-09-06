package idsigner

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/auth/assertid"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var _ assertid.Service = &Service{}

const cacheKeyPrefix = "assertid"

type TokenSigner interface {
	SignToken(claims *jwt.Claims, assertions *IDAssertions) (string, error)
}

// Service implements the AssertID service.
type Service struct {
	Signer            TokenSigner
	logger            log.Logger
	remoteCache       remotecache.CacheStorage
	signingKeyService signingkeys.Service
	cfg               *setting.Cfg
	teams             team.Service
}

type IDAssertions struct {
	Teams     []string `json:"groups"`
	IPAddress string   `json:"ip"`
}

// ProvideIDSigningService returns a new instance of the AssertID service.
func ProvideIDSigningService(
	remoteCache remotecache.CacheStorage, cfg *setting.Cfg,
	signingKeyService signingkeys.Service, teams team.Service,
) *Service {
	service := &Service{
		logger:            log.New("auth.assertid"),
		remoteCache:       remoteCache,
		cfg:               cfg,
		signingKeyService: signingKeyService,
		teams:             teams,
		Signer:            nil,
	}

	signer, err := newLocalSigner(signingKeyService)
	if err != nil {
		service.logger.Error("Unable to create signer", "error", err)
	} else {
		service.Signer = signer
	}

	return service
}

func (s *Service) GenerateUserAssertion(ctx context.Context, id identity.Requester, req *http.Request) (*IDAssertions, error) {
	idAssertions := &IDAssertions{
		Teams:     []string{},
		IPAddress: "",
	}

	var userID int64
	namespace, identifier := id.GetNamespacedID()
	if namespace == identity.NamespaceUser || namespace == identity.NamespaceServiceAccount {
		var err error
		userID, err = identity.IntIdentifier(namespace, identifier)
		if err != nil {
			return nil, err
		}

		// Get the user's teams.
		query := team.GetTeamsByUserQuery{OrgID: id.GetOrgID(), UserID: userID, SignedInUser: id}
		teams, err := s.teams.GetTeamsByUser(ctx, &query)
		if err != nil {
			return nil, err
		}

		for _, team := range teams {
			idAssertions.Teams = append(idAssertions.Teams, team.Name)
		}
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

	idAssertions.IPAddress = clientIPStr

	return idAssertions, nil
}

// ActiveUserAssertion returns the active user assertion.
func (s *Service) ActiveUserAssertion(ctx context.Context, id identity.Requester, req *http.Request) (string, error) {
	if s.Signer == nil {
		return "", fmt.Errorf("signer unavailable")
	}

	namespace, identifier := id.GetNamespacedID()
	if !canGenerateToken(namespace) {
		// skip for namespaces we cannot generate a token for e.g. anonymous
		return "", nil
	}

	// safe to ignore error because of check above
	cacheKey, _ := id.GetCacheKey()
	val, err := s.remoteCache.Get(ctx, getCacheKey(cacheKey))
	if err == nil {
		return string(val), nil
	}

	// Set the JWT claims.
	claims := &jwt.Claims{
		Issuer:   fmt.Sprintf("grn:%d:instance/%s", id.GetOrgID(), s.cfg.AppURL),
		Subject:  fmt.Sprintf("%s:%s", namespace, identifier),
		Audience: jwt.Audience{fmt.Sprintf("grn:%d:instance/%s", id.GetOrgID(), s.cfg.AppURL)},
		Expiry:   jwt.NewNumericDate(time.Now().Add(time.Minute * 5)),
		IssuedAt: jwt.NewNumericDate(time.Now()),
		ID:       identifier,
	}

	assertions, err := s.GenerateUserAssertion(ctx, id, req)
	if err != nil {
		return "", err
	}

	// sign the claims and assetion
	token, err := s.Signer.SignToken(claims, assertions)
	if err != nil {
		return "", err
	}

	if err := s.remoteCache.Set(ctx, getCacheKey(cacheKey), []byte(token), time.Minute*4); err != nil {
		s.logger.Error("failed to set cache", "error", err)
	}

	return token, nil
}

func canGenerateToken(namespace string) bool {
	return namespace == identity.NamespaceUser ||
		namespace == identity.NamespaceAPIKey ||
		namespace == identity.NamespaceServiceAccount
}

func getCacheKey(key string) string {
	return fmt.Sprintf("%s-%s", cacheKeyPrefix, key)
}
